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
            
            relevant_segments = []
            for seg in transcript_data["segments"]:
                if seg["start"] < clip_end and seg["end"] > clip_start:
                    relevant_segments.append(seg)
                    
            clip_data["segments"] = relevant_segments
            clip_data["layout"] = layout
            
            final_clip_path, srt_path, thumbnail_path = process_clip(
                video_path, clip_data, CLIPS_DIR, SUBTITLES_DIR, job_id, idx
            )
            
            clip_filename = os.path.basename(final_clip_path)
            thumb_filename = os.path.basename(thumbnail_path)
            
            return {
                "title": clip_data.get("title", f"Clip {idx+1}"),
                "score": clip_data.get("score", 0),
                "reasoning": clip_data.get("reasoning", ""),
                "video_url": f"/temp/Clips/{clip_filename}",
                "thumbnail_url": f"/temp/Clips/{thumb_filename}",
                "segments": relevant_segments
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True, use_reloader=False)
