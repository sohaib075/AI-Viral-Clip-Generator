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
if not os.path.exists(TEMP_DIR):
    os.makedirs(TEMP_DIR, exist_ok=True)

# Simple in-memory job tracker
JOBS = {}

def process_video_job(job_id, video_url):
    try:
        JOBS[job_id] = {"status": "processing", "progress": 10, "message": "Downloading video...", "clips": []}
        
        def yt_progress(p):
            current_p = 10 + int((p / 100.0) * 20)
            JOBS[job_id]["progress"] = current_p
            JOBS[job_id]["message"] = f"Downloading video... {p:.1f}%"

        # 1. Download Video (or use local file if uploaded)
        if video_url.startswith('file://'):
            # It's a direct file upload from the Node backend
            import urllib.request
            video_path = urllib.request.url2pathname(video_url[7:])
        else:
            video_path = download_video(video_url, TEMP_DIR, progress_callback=yt_progress)
        
        # 2. Extract Audio
        JOBS[job_id] = {"status": "processing", "progress": 30, "message": "Extracting audio...", "clips": []}
        audio_path = extract_audio(video_path, TEMP_DIR)
        
        # 3. Transcribe
        JOBS[job_id] = {"status": "processing", "progress": 50, "message": "Transcribing with Whisper...", "clips": []}
        transcript_data = transcribe_audio(audio_path)
        if not transcript_data:
            raise Exception("Transcription failed.")
            
        # 4. NLP Highlights
        JOBS[job_id] = {"status": "processing", "progress": 70, "message": "Running NLP Highlight Detection...", "clips": []}
        highlights = extract_highlights(transcript_data, num_clips=3)
        
        # 5. Video Editing
        JOBS[job_id] = {"status": "processing", "progress": 85, "message": "Generating Vertical Clips & Subtitles...", "clips": []}
        final_clips = []
        for idx, clip_data in enumerate(highlights):
            final_clip_path = process_clip(video_path, clip_data, TEMP_DIR, idx)
            # Make the path relative to TEMP_DIR for the frontend
            relative_path = os.path.basename(final_clip_path)
            final_clips.append({
                "title": clip_data.get("title", f"Clip {idx+1}"),
                "score": clip_data.get("score", 0),
                "reasoning": clip_data.get("reasoning", ""),
                "video_url": f"/temp/{relative_path}"
            })
            
        JOBS[job_id] = {
            "status": "completed", 
            "progress": 100, 
            "message": "Processing Complete!", 
            "clips": final_clips
        }
        
    except Exception as e:
        print(f"Job {job_id} failed: {traceback.format_exc()}")
        JOBS[job_id] = {
            "status": "failed", 
            "progress": 0, 
            "message": f"Error: {str(e)}", 
            "clips": []
        }

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
    
    # Start background processing
    thread = threading.Thread(target=process_video_job, args=(job_id, video_url))
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
