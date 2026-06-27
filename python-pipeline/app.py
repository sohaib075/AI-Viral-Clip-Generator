from flask import Flask, request, jsonify
import os
import threading
import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")
import traceback
from downloader import download_video
from audio_extractor import extract_audio
from transcriber import transcribe_audio
from nlp_highlight import extract_highlights
from video_editor import process_clip

app = Flask(__name__)

TEMP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../temp'))
INPUT_DIR = os.path.join(TEMP_DIR, 'Input')
PROCESSED_DIR = os.path.join(TEMP_DIR, 'Processed')
CLIPS_DIR = os.path.join(TEMP_DIR, 'Clips')
SUBTITLES_DIR = os.path.join(TEMP_DIR, 'Subtitles')
LOGS_DIR = os.path.join(TEMP_DIR, 'Logs')

for d in [TEMP_DIR, INPUT_DIR, PROCESSED_DIR, CLIPS_DIR, SUBTITLES_DIR, LOGS_DIR]:
    if not os.path.exists(d):
        os.makedirs(d, exist_ok=True)

# Simple in-memory job tracker
JOBS = {}

def log_job_message(job_id, message):
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] [{job_id}] {message}\n"
    print(f"[{job_id}] {message}")
    
    log_file_path = os.path.join(LOGS_DIR, f"{job_id}.log")
    try:
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(log_line)
    except Exception as e:
        print(f"Failed to write log to {log_file_path}: {e}")

def update_job_status(job_id, status=None, progress=None, message=None, clips=None, transcript=None):
    if job_id not in JOBS:
        JOBS[job_id] = {"status": "processing", "progress": 0, "message": "", "clips": []}
    
    if status is not None:
        JOBS[job_id]["status"] = status
    if progress is not None:
        JOBS[job_id]["progress"] = progress
    if message is not None:
        JOBS[job_id]["message"] = message
        log_job_message(job_id, message)
    if clips is not None:
        JOBS[job_id]["clips"] = clips
    if transcript is not None:
        JOBS[job_id]["transcript"] = transcript

def process_video_job(job_id, video_url, layout='vertical'):
    try:
        log_job_message(job_id, f"=== Starting Video Processing Job ===")
        log_job_message(job_id, f"URL: {video_url}")
        
        update_job_status(job_id, status="processing", progress=10, message="Initializing job and checking download settings...")
        
        last_printed_p = -1
        def yt_progress(p):
            nonlocal last_printed_p
            current_p = 10 + int((p / 100.0) * 20)
            JOBS[job_id]["progress"] = current_p
            JOBS[job_id]["message"] = f"Downloading video... {p:.1f}%"
            if int(p) % 10 == 0 and int(p) != last_printed_p:
                log_job_message(job_id, f"📥 Downloading... {int(p)}%")
                last_printed_p = int(p)

        # 1. Download Video (or use local file if uploaded)
        if video_url.startswith('file://'):
            import urllib.request
            raw_path = urllib.request.url2pathname(video_url[7:])
            base_name = os.path.basename(raw_path)
            dest_path = os.path.join(INPUT_DIR, base_name)
            if os.path.exists(raw_path) and os.path.abspath(raw_path) != os.path.abspath(dest_path):
                import shutil
                shutil.move(raw_path, dest_path)
                video_path = dest_path
                log_job_message(job_id, f"Moved uploaded video file to Input folder: {video_path}")
            else:
                video_path = raw_path
                log_job_message(job_id, f"Using pre-placed upload file: {video_path}")
        else:
            log_job_message(job_id, "Downloading video using yt-dlp...")
            video_path = download_video(video_url, INPUT_DIR, progress_callback=yt_progress)
            log_job_message(job_id, f"Video downloaded to Input folder: {video_path}")
        
        # 2. Extract Audio
        update_job_status(job_id, progress=30, message="Extracting audio track...")
        audio_path = extract_audio(video_path, PROCESSED_DIR)
        log_job_message(job_id, f"Audio extracted to Processed folder: {audio_path}")
        
        # 3. Transcribe
        update_job_status(job_id, progress=50, message="Transcribing audio with Whisper (Groq)...")
        transcript_data = transcribe_audio(audio_path)
        if not transcript_data:
            raise Exception("Transcription failed.")
            
        log_job_message(job_id, f"Transcription complete! Transcribed {len(transcript_data.get('segments', []))} segments.")
        
        # Save transcript JSON for record-keeping
        transcript_json_path = os.path.join(PROCESSED_DIR, f"Transcript_{job_id}.json")
        import json
        with open(transcript_json_path, "w", encoding="utf-8") as f:
            json.dump(transcript_data, f, indent=2, ensure_ascii=False)
        log_job_message(job_id, f"Saved transcript asset to Processed folder: {transcript_json_path}")
            
        # 4. NLP Highlights
        update_job_status(job_id, progress=70, message="Scanning transcript for viral highlights using Gemini...")
        highlights = extract_highlights(transcript_data, num_clips=10)
        log_job_message(job_id, f"Highlight detection complete! Found {len(highlights)} potential clips.")
        
        # 5. Video Editing
        update_job_status(job_id, progress=85, message="Rendering vertical clips with burnt-in subtitles...")
        final_clips = []
        
        import concurrent.futures
        
        def process_highlight(idx_and_clip):
            idx, clip_data = idx_and_clip
            
            clip_start = clip_data.get('start_time', 0.0)
            clip_end = clip_data.get('end_time', 0.0)
            clip_duration = clip_end - clip_start
            if clip_duration <= 0:
                clip_duration = 15.0
                clip_end = clip_start + 15.0
            
            relevant_segments = []
            for seg in transcript_data.get("segments", []):
                if seg["start"] < clip_end and seg["end"] > clip_start:
                    relevant_segments.append(seg)
                    
            relevant_words = []
            if "words" in transcript_data:
                for w in transcript_data["words"]:
                    if w["start"] < clip_end and w["end"] > clip_start:
                        relevant_words.append(w)
                        
            if not relevant_words:
                log_job_message(job_id, f"WARNING: Clip {idx+1} missing captions. Generating estimated captions.")
                title_words = clip_data.get("title", f"Clip {idx+1}").split()
                if not title_words: title_words = ["Highlight"]
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
            final_clip_path, base_clip_path, thumbnail_path = None, None, None
            
            for attempt in range(max_render_retries):
                try:
                    final_clip_path, base_clip_path, srt_path, thumbnail_path = process_clip(
                        video_path, clip_data, CLIPS_DIR, SUBTITLES_DIR, job_id, idx
                    )
                    break
                except Exception as e:
                    log_job_message(job_id, f"ERROR: Clip {idx+1} render failed on attempt {attempt+1}: {e}")
                    if attempt == max_render_retries - 1:
                        raise e
            
            clip_filename = os.path.basename(final_clip_path)
            base_filename = os.path.basename(base_clip_path)
            thumb_filename = os.path.basename(thumbnail_path)
            
            return {
                "title": clip_data.get("title", f"Clip {idx+1}"),
                "start_time": clip_start,
                "end_time": clip_end,
                "score": clip_data.get("score", 0),
                "reasoning": clip_data.get("reasoning", ""),
                "video_url": f"/temp/Clips/{clip_filename}",
                "base_url": f"/temp/Clips/{base_filename}",
                "thumbnail_url": f"/temp/Clips/{thumb_filename}",
                "segments": relevant_segments,
                "words": relevant_words,
                "metadata": clip_data.get("metadata", {}),
                "emphasized_words": clip_data.get("emphasized_words", [])
            }
            
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            items = list(enumerate(highlights))
            for result in executor.map(process_highlight, items):
                final_clips.append(result)
                log_job_message(job_id, f"Clip rendered: {result['title']} ({len(final_clips)}/{len(highlights)})")
            
        update_job_status(
            job_id,
            status="completed",
            progress=100,
            message="Processing Complete!",
            clips=final_clips,
            transcript=transcript_data.get("text", "") if transcript_data else ""
        )
        log_job_message(job_id, f"Job Completed Successfully! Generated {len(final_clips)} clips.")
        
    except Exception as e:
        error_msg = f"Error: {str(e)}\n{traceback.format_exc()}"
        log_job_message(job_id, f"ERROR: Job failed!\n{error_msg}")
        update_job_status(job_id, status="failed", progress=0, message=f"Error: {str(e)}")

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "ai-pipeline"})

@app.route('/api/process', methods=['POST'])
def process_video():
    data = request.json
    if not data or 'jobId' not in data or 'videoUrl' not in data:
        return jsonify({"error": "Missing jobId or videoUrl"}), 400
    
    job_id = data['jobId']
    video_url = data['videoUrl']
    layout = data.get('layout', 'vertical')
    
    # Start background processing
    thread = threading.Thread(target=process_video_job, args=(job_id, video_url, layout))
    thread.daemon = True
    thread.start()
    
    return jsonify({
        "message": f"Processing started for {job_id}",
        "status": "processing"
    })

@app.route('/api/status/<job_id>', methods=['GET'])
def get_status(job_id):
    if job_id not in JOBS:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(JOBS[job_id])

@app.route('/api/export', methods=['POST'])
def export_clip():
    data = request.json
    if not data or 'jobId' not in data or 'clipUrl' not in data or 'styleConfig' not in data:
        return jsonify({"error": "Missing required fields"}), 400
    
    job_id = data['jobId']
    clip_url = data['clipUrl']
    style_config = data['styleConfig']
    clip_data = data.get('clipData', {})
    
    base_filename = os.path.basename(clip_url)
    base_clip_path = os.path.join(CLIPS_DIR, base_filename)
    
    if not os.path.exists(base_clip_path):
        return jsonify({"error": "Base clip not found"}), 404
        
    final_filename = base_filename.replace('_base.mp4', '_final.mp4')
    if '_base' not in base_filename:
        final_filename = base_filename.replace('.mp4', '_final.mp4')
        
    final_output_path = os.path.join(CLIPS_DIR, final_filename)
    
    try:
        from video_editor import burn_subtitles
        burn_subtitles(base_clip_path, clip_data, style_config, final_output_path)
        return jsonify({"success": True, "export_url": f"/temp/Clips/{final_filename}"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True, use_reloader=False)
