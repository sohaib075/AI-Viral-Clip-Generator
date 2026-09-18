import sys
import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

# Titles and progress messages can contain emoji or non-Latin text. Don't let a legacy console
# encoding (e.g. cp1252 when output is redirected on Windows) crash a job while printing them.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(errors='replace')
    except (AttributeError, ValueError):
        pass

import asyncio
import concurrent.futures
import datetime
import json
import os
import re
import threading
import time
import traceback
from urllib.parse import urlparse

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from downloader import download_video, resolve_local_upload
from audio_extractor import extract_audio
from transcriber import transcribe_audio
from nlp_highlight import extract_highlights
from video_editor import process_clip, burn_subtitles, extract_thumbnail
from story_video_maker import compile_story_video
from media_utils import get_media_duration, remove_files

app = Flask(__name__)

TEMP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../temp'))
INPUT_DIR = os.path.join(TEMP_DIR, 'Input')
PROCESSED_DIR = os.path.join(TEMP_DIR, 'Processed')
CLIPS_DIR = os.path.join(TEMP_DIR, 'Clips')
SUBTITLES_DIR = os.path.join(TEMP_DIR, 'Subtitles')
LOGS_DIR = os.path.join(TEMP_DIR, 'Logs')
STORY_DIR = os.path.join(TEMP_DIR, 'StoryVideos')

for d in [TEMP_DIR, INPUT_DIR, PROCESSED_DIR, CLIPS_DIR, SUBTITLES_DIR, LOGS_DIR, STORY_DIR]:
    os.makedirs(d, exist_ok=True)

# Each job renders several clips in parallel, so only a few jobs run at once; the rest wait their turn
MAX_CONCURRENT_JOBS = max(1, int(os.environ.get('MAX_CONCURRENT_JOBS') or 2))
# Finished jobs are kept in memory this long (the backend saves its own copy)
FINISHED_JOB_TTL_SECONDS = 24 * 3600
# Rendered clips, logs and uploads are kept forever unless this is set (in days)
OUTPUT_RETENTION_DAYS = max(0.0, float(os.environ.get('OUTPUT_RETENTION_DAYS') or 0))
# Sweeping every directory on every job would be wasteful, so do it at most once an hour
RETENTION_SWEEP_INTERVAL_SECONDS = 3600
# Job ids end up in file names
JOB_ID_PATTERN = re.compile(r'^[A-Za-z0-9_-]{1,100}$')
BASE_CLIP_PATTERN = re.compile(r'^[\w.-]+_base\.mp4$')

JOBS = {}
JOBS_LOCK = threading.Lock()
LAST_RETENTION_SWEEP = 0.0
JOB_EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=MAX_CONCURRENT_JOBS)

def log_job_message(job_id, message):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] [{job_id}] {message}\n"
    print(f"[{job_id}] {message}")

    log_file_path = os.path.join(LOGS_DIR, f"{job_id}.log")
    try:
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(log_line)
    except Exception as e:
        print(f"Failed to write log to {log_file_path}: {e}")

def update_job_status(job_id, status=None, progress=None, message=None, log=True, **fields):
    """
    Updates a job in one step, so a status check never sees e.g. 'completed' before the clips are set.
    Extra keyword fields (clips, transcript, warnings...) are stored when not None.
    """
    with JOBS_LOCK:
        job = JOBS.setdefault(job_id, {"status": "processing", "progress": 0, "message": "", "clips": []})
        job.update({key: value for key, value in fields.items() if value is not None})
        if progress is not None:
            job["progress"] = progress
        if message is not None:
            job["message"] = message
        if status is not None:
            job["status"] = status
            if status in ("completed", "failed"):
                job["finished_at"] = time.time()
    if message is not None and log:
        log_job_message(job_id, message)

def get_job(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        return dict(job) if job else None

def prune_finished_jobs():
    cutoff = time.time() - FINISHED_JOB_TTL_SECONDS
    with JOBS_LOCK:
        for job_id in [key for key, job in JOBS.items() if job.get("finished_at", time.time()) < cutoff]:
            del JOBS[job_id]

def prune_old_outputs():
    """Deletes rendered output older than OUTPUT_RETENTION_DAYS. Off unless the variable is set."""
    global LAST_RETENTION_SWEEP
    now = time.time()
    if OUTPUT_RETENTION_DAYS <= 0 or now - LAST_RETENTION_SWEEP < RETENTION_SWEEP_INTERVAL_SECONDS:
        return
    LAST_RETENTION_SWEEP = now
    cutoff = now - OUTPUT_RETENTION_DAYS * 86400
    removed = 0
    for directory in (INPUT_DIR, PROCESSED_DIR, CLIPS_DIR, SUBTITLES_DIR, LOGS_DIR, STORY_DIR):
        try:
            entries = os.scandir(directory)
        except OSError as e:
            print(f"Retention sweep could not read {directory}: {e}")
            continue
        with entries:
            for entry in entries:
                try:
                    # mtime, not ctime: a clip restyled today should survive the sweep
                    if not entry.is_file(follow_symlinks=False) or entry.stat().st_mtime >= cutoff:
                        continue
                    os.remove(entry.path)
                    removed += 1
                except OSError as e:
                    print(f"Retention sweep could not delete {entry.path}: {e}")
    if removed:
        print(f"Retention sweep deleted {removed} file(s) older than {OUTPUT_RETENTION_DAYS} day(s).")

def run_job(job_id, target, *args):
    """Runs a job function and records any failure as the job's status."""
    try:
        target(job_id, *args)
    except Exception as e:
        log_job_message(job_id, f"ERROR: Job failed!\nError: {e}\n{traceback.format_exc()}")
        update_job_status(job_id, status="failed", progress=0, message=f"Error: {e}", log=False)

def submit_job(job_id, target, *args):
    prune_finished_jobs()
    prune_old_outputs()
    # Registered before it starts, so status checks never see a 404 while it waits for a worker
    update_job_status(job_id, status="processing", progress=0, message="Waiting for other jobs to finish...", log=False)
    JOB_EXECUTOR.submit(run_job, job_id, target, *args)

def clip_url(folder, path):
    return f"/temp/{folder}/{os.path.basename(path)}" if path else None

def process_video_job(job_id, video_url, layout='vertical'):
    log_job_message(job_id, f"=== Starting Video Processing Job ===")
    log_job_message(job_id, f"URL: {video_url}")

    update_job_status(job_id, progress=10, message="Initializing job and checking download settings...")

    last_logged_percent = -1
    def yt_progress(p):
        nonlocal last_logged_percent
        update_job_status(job_id, progress=10 + int((p / 100.0) * 20), message=f"Downloading video... {p:.1f}%", log=False)
        if int(p) % 10 == 0 and int(p) != last_logged_percent:
            log_job_message(job_id, f"📥 Downloading... {int(p)}%")
            last_logged_percent = int(p)

    video_path = None
    audio_path = None
    source_title = None
    job_warnings = []
    try:
        # 1. Download Video (or use local file if uploaded)
        if video_url.startswith('file://'):
            video_path = resolve_local_upload(video_url, INPUT_DIR)
            log_job_message(job_id, f"Using uploaded video file: {video_path}")
        else:
            log_job_message(job_id, "Downloading video using yt-dlp...")
            video_path, site_info = download_video(video_url, INPUT_DIR, progress_callback=yt_progress, file_prefix=job_id)
            source_title = site_info.get("title")
            log_job_message(job_id, f"Video downloaded to Input folder: {video_path}")
        source_duration = get_media_duration(video_path)

        # 2. Extract Audio
        update_job_status(job_id, progress=30, message="Extracting audio track...")
        audio_path = extract_audio(video_path, PROCESSED_DIR)
        log_job_message(job_id, f"Audio extracted to Processed folder: {audio_path}")

        # 3. Transcribe
        update_job_status(job_id, progress=50, message="Transcribing audio with Whisper (Groq)...")
        transcript_data = transcribe_audio(audio_path)
        if not transcript_data or not transcript_data.get('segments'):
            raise Exception("Transcription failed: no speech was transcribed.")

        log_job_message(job_id, f"Transcription complete! Transcribed {len(transcript_data.get('segments', []))} segments.")
        failed_chunks = transcript_data.get('failed_chunks') or []
        if failed_chunks:
            job_warnings.append(f"{len(failed_chunks)} part(s) of the audio could not be transcribed, so highlights from those parts may be missing.")
            log_job_message(job_id, f"WARNING: {job_warnings[-1]}")

        # Save transcript JSON for record-keeping
        transcript_json_path = os.path.join(PROCESSED_DIR, f"Transcript_{job_id}.json")
        with open(transcript_json_path, "w", encoding="utf-8") as f:
            json.dump(transcript_data, f, indent=2, ensure_ascii=False)
        log_job_message(job_id, f"Saved transcript asset to Processed folder: {transcript_json_path}")

        # 4. NLP Highlights
        update_job_status(job_id, progress=70, message="Scanning transcript for viral highlights using Gemini...")
        highlights = extract_highlights(transcript_data, num_clips=10)
        if not highlights:
            raise Exception("No highlights could be found in the transcript.")
        log_job_message(job_id, f"Highlight detection complete! Found {len(highlights)} potential clips.")

        # 5. Video Editing
        shape = "horizontal" if layout == "horizontal" else "vertical"
        update_job_status(job_id, progress=85, message=f"Rendering {shape} clips with burnt-in subtitles...")
        final_clips = []

        def process_highlight(idx_and_clip):
            idx, clip_data = idx_and_clip

            clip_start = max(0.0, float(clip_data.get('start_time') or 0.0))
            clip_end = float(clip_data.get('end_time') or 0.0)
            if clip_end <= clip_start:
                clip_end = clip_start + 15.0
            if source_duration:
                clip_end = min(clip_end, source_duration)
                if clip_end <= clip_start:
                    raise Exception("The highlight starts after the end of the video.")
            clip_duration = clip_end - clip_start
            # process_clip reads the times from clip_data, so store the corrected values there
            clip_data['start_time'] = clip_start
            clip_data['end_time'] = clip_end

            relevant_segments = [seg for seg in transcript_data.get("segments", [])
                                 if seg["start"] < clip_end and seg["end"] > clip_start]
            relevant_words = [w for w in transcript_data.get("words", [])
                              if w["start"] < clip_end and w["end"] > clip_start]

            if not relevant_words:
                log_job_message(job_id, f"WARNING: Clip {idx+1} missing captions. Generating estimated captions.")
                title_words = str(clip_data.get("title") or f"Clip {idx+1}").split() or ["Highlight"]
                word_dur = clip_duration / len(title_words)
                for i, tw in enumerate(title_words):
                    relevant_words.append({
                        "start": clip_start + (i * word_dur),
                        "end": clip_start + ((i+1) * word_dur),
                        "word": tw
                    })

            clip_data["segments"] = relevant_segments
            clip_data["words"] = relevant_words
            clip_data["layout"] = layout

            max_render_retries = 3
            for attempt in range(max_render_retries):
                try:
                    final_clip_path, base_clip_path, srt_path, thumbnail_path = process_clip(
                        video_path, clip_data, CLIPS_DIR, SUBTITLES_DIR, job_id, idx
                    )
                    break
                except Exception as e:
                    log_job_message(job_id, f"ERROR: Clip {idx+1} render failed on attempt {attempt+1}: {e}")
                    if attempt == max_render_retries - 1:
                        raise

            return {
                "title": clip_data.get("title", f"Clip {idx+1}"),
                "start_time": clip_start,
                "end_time": clip_end,
                "score": clip_data.get("score", 0),
                "reasoning": clip_data.get("reasoning", ""),
                "video_url": clip_url("Clips", final_clip_path),
                "base_url": clip_url("Clips", base_clip_path),
                "thumbnail_url": clip_url("Clips", thumbnail_path),
                "segments": relevant_segments,
                "words": relevant_words,
                "metadata": clip_data.get("metadata", {}),
                "emphasized_words": clip_data.get("emphasized_words", []),
                "layout": layout
            }

        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(process_highlight, item) for item in enumerate(highlights)]
            for idx, future in enumerate(futures):
                # One bad highlight shouldn't throw away every other clip
                try:
                    result = future.result()
                except Exception as e:
                    log_job_message(job_id, f"ERROR: Skipping clip {idx+1}: {e}")
                    continue
                final_clips.append(result)
                update_job_status(job_id, progress=85 + int(14 * (idx + 1) / len(futures)),
                                  message=f"Clip rendered: {result['title']} ({len(final_clips)}/{len(highlights)})")

        if not final_clips:
            raise Exception("None of the clips could be rendered.")
        if len(final_clips) < len(highlights):
            job_warnings.append(f"{len(highlights) - len(final_clips)} of {len(highlights)} highlights could not be rendered.")

        update_job_status(
            job_id,
            status="completed",
            progress=100,
            message="Processing Complete!",
            clips=final_clips,
            transcript=transcript_data.get("text", ""),
            source_title=source_title,
            source_duration=source_duration,
            warnings=job_warnings
        )
        log_job_message(job_id, f"Job Completed Successfully! Generated {len(final_clips)} clips.")
    finally:
        # The source video and extracted audio aren't needed once the clips are rendered
        remove_files(video_path, audio_path)

def process_story_job(job_id, story, style, voice, aspect_ratio):
    log_job_message(job_id, f"=== Starting Story to Video Job ===")
    update_job_status(job_id, status="processing", progress=10, message="Breaking story into scenes with LLM...")

    output_filename = f"story_{job_id}.mp4"

    def progress_cb(p, msg):
        update_job_status(job_id, progress=p, message=msg)

    # asyncio.run creates and closes a fresh event loop for this worker thread
    final_video_path = asyncio.run(
        compile_story_video(story, style, voice, aspect_ratio, output_filename, STORY_DIR, progress_cb)
    )
    thumbnail_path = extract_thumbnail(final_video_path, 1.0, os.path.join(STORY_DIR, f"story_{job_id}.jpg"))

    final_clips = [{
        "title": "Generated Story Video",
        "video_url": clip_url("StoryVideos", final_video_path),
        "thumbnail_url": clip_url("StoryVideos", thumbnail_path),
        "layout": aspect_ratio
    }]

    update_job_status(
        job_id,
        status="completed",
        progress=100,
        message="Story Video Generation Complete!",
        clips=final_clips
    )
    log_job_message(job_id, f"Job Completed Successfully! Video saved to {final_video_path}")

def social_metadata(analysis):
    """Auto Edit produces one title/description/hashtag set; give it the per-platform shape clip jobs use."""
    title = str(analysis.get("title") or "")
    description = str(analysis.get("description") or "")
    hashtags = [str(tag).strip().lstrip('#') for tag in (analysis.get("hashtags") or []) if str(tag).strip()]
    platform_copy = {"title": title, "description": description, "hashtags": hashtags}
    return {
        "tiktok": platform_copy,
        "instagram": platform_copy,
        "youtube_shorts": platform_copy,
        "linkedin": {"post": "\n\n".join(part for part in (title, description) if part), "hashtags": hashtags},
        "x": {"tweet": title, "hashtags": hashtags},
    }

def process_auto_edit_job(job_id, video_url, layout, style, prompt):
    from advanced_editor import process_auto_edit
    log_job_message(job_id, f"=== Starting Professional Auto Edit Job ===")
    log_job_message(job_id, f"Style: {style}, Layout: {layout}, Prompt: {prompt}")

    def progress_cb(p, msg):
        update_job_status(job_id, progress=p, message=msg)

    final_video_path, analysis, info = process_auto_edit(
        job_id, video_url, layout, style, prompt, progress_cb, INPUT_DIR, PROCESSED_DIR, CLIPS_DIR
    )

    final_clips = [{
        "title": analysis.get("title") or f"Auto Edited Video ({style})",
        "video_url": clip_url("Clips", final_video_path),
        "base_url": clip_url("Clips", info.get("base_path")),
        "thumbnail_url": clip_url("Clips", info.get("thumbnail_path")),
        "metadata": social_metadata(analysis),
        "layout": layout,
        "segments": (info.get("clip_data") or {}).get("segments") or [],
        "words": (info.get("clip_data") or {}).get("words") or [],
        "start_time": 0.0,
        "end_time": (info.get("clip_data") or {}).get("end") or 0.0,
    }]

    update_job_status(
        job_id,
        status="completed",
        progress=100,
        message="Auto Edit Generation Complete!",
        clips=final_clips,
        source_title=info.get("source_title"),
        source_duration=info.get("source_duration"),
        warnings=info.get("warnings") or []
    )
    log_job_message(job_id, f"Job Completed Successfully! Video saved to {final_video_path}")

def json_body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else None

def start_job_or_error(data, target, *args):
    job_id = data.get('jobId')
    if not isinstance(job_id, str) or not JOB_ID_PATTERN.match(job_id):
        return jsonify({"error": "Missing or invalid jobId"}), 400
    if get_job(job_id):
        return jsonify({"error": "A job with this id already exists"}), 409
    submit_job(job_id, target, *args)
    return jsonify({"message": f"Processing started for {job_id}", "status": "processing"})


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "ai-pipeline"})

@app.route('/api/process', methods=['POST'])
def process_video():
    data = json_body()
    if not data or not isinstance(data.get('videoUrl'), str):
        return jsonify({"error": "Missing jobId or videoUrl"}), 400
    layout = data.get('layout') if data.get('layout') in ('vertical', 'horizontal') else 'vertical'
    return start_job_or_error(data, process_video_job, data['videoUrl'], layout)

@app.route('/api/story-to-video', methods=['POST'])
def process_story_video():
    data = json_body()
    if not data or not isinstance(data.get('story'), str) or not data['story'].strip():
        return jsonify({"error": "Missing jobId or story"}), 400
    style = str(data.get('style') or 'Cinematic')
    voice = str(data.get('voice') or 'en-US-ChristopherNeural')
    aspect_ratio = data.get('aspectRatio') if data.get('aspectRatio') in ('9:16', '16:9', '1:1') else '9:16'
    return start_job_or_error(data, process_story_job, data['story'], style, voice, aspect_ratio)

@app.route('/api/auto-edit', methods=['POST'])
def auto_edit_video():
    data = json_body()
    if not data or not isinstance(data.get('videoUrl'), str):
        return jsonify({"error": "Missing jobId or videoUrl"}), 400
    layout = data.get('layout') if data.get('layout') in ('9:16', '16:9', '1:1') else '9:16'
    style = str(data.get('style') or 'Cinematic')
    prompt = str(data.get('prompt') or '')
    return start_job_or_error(data, process_auto_edit_job, data['videoUrl'], layout, style, prompt)

@app.route('/api/status/<job_id>', methods=['GET'])
def get_status(job_id):
    job = get_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job)

@app.route('/api/export', methods=['POST'])
def export_clip():
    data = json_body()
    if not data or not isinstance(data.get('clipUrl'), str) or not isinstance(data.get('styleConfig'), dict):
        return jsonify({"error": "Missing required fields"}), 400
    clip_data = data.get('clipData') if isinstance(data.get('clipData'), dict) else {}

    # Only a clip's caption-free base render can be re-styled; other videos already have captions burned in
    base_filename = os.path.basename(urlparse(data['clipUrl']).path)
    if not BASE_CLIP_PATTERN.match(base_filename):
        return jsonify({"error": "Only generated highlight clips can be re-styled."}), 400
    base_clip_path = os.path.join(CLIPS_DIR, base_filename)
    if not os.path.isfile(base_clip_path):
        return jsonify({"error": "Base clip not found"}), 404

    final_filename = base_filename[:-len('_base.mp4')] + '_final.mp4'
    final_output_path = os.path.join(CLIPS_DIR, final_filename)

    try:
        burn_subtitles(base_clip_path, clip_data, data['styleConfig'], final_output_path)
        return jsonify({"success": True, "export_url": f"/temp/Clips/{final_filename}"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Export failed: {e}"}), 500

if __name__ == '__main__':
    # Listen on localhost only unless told otherwise (Docker sets FLASK_HOST=0.0.0.0).
    # The Werkzeug debugger must never be reachable from the network, so debug is opt-in.
    host = os.environ.get('FLASK_HOST', '127.0.0.1')
    port = int(os.environ.get('PORT') or 5001)
    debug = os.environ.get('FLASK_DEBUG', '').lower() in ('1', 'true', 'yes')
    prune_old_outputs()
    app.run(host=host, port=port, debug=debug, use_reloader=False)
