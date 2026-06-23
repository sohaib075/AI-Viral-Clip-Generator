from flask import Flask, request, jsonify
import os

app = Flask(__name__)

TEMP_DIR = os.path.abspath(os.path.join(os.path.dirname(__name__), '../temp'))
if not os.path.exists(TEMP_DIR):
    os.makedirs(TEMP_DIR, exist_ok=True)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "ai-pipeline"})

@app.route('/api/process', methods=['POST'])
def process_video():
    data = request.json
    if not data or 'jobId' not in data:
        return jsonify({"error": "Missing jobId"}), 400
    
    job_id = data['jobId']
    # Future: Kick off processing here (yt-dlp, whisper, ffmpeg)
    
    return jsonify({
        "message": f"Processing started for {job_id}",
        "status": "processing"
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
