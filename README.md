# AI Viral Clip Generator

An intelligent, fully open-source system for automated detection, editing, and distribution of viral video content.

## Project Structure
- `frontend/`: React + Vite application (UI)
- `backend/`: Node.js + Express API server (File uploads and job management)
- `python-pipeline/`: Python Flask server and AI scripts (Whisper, NLP, FFmpeg, MoviePy)
- `temp/`: Temporary storage for uploaded videos and processed clips

---

## How to Run the Complete Project Locally

To run the entire system, you need to start three separate servers. Open three separate terminal windows and run the following commands.

### 1. Start the Node.js Backend Server
This server handles video uploads and communicates with the Python pipeline.
```bash
cd backend
npm install   # Only needed the first time
node index.js
```
*The backend will run on `http://localhost:5000`*

### 2. Start the Python AI Pipeline
This server handles transcription, NLP highlight detection, and video rendering.
```bash
cd python-pipeline

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
# source venv/bin/activate

# Install requirements (Only needed the first time)
pip install -r requirements.txt

# Start the Flask server
python app.py
```
*The Python pipeline will run on `http://localhost:5001`*

### 3. Start the React Frontend
This is the user interface where you upload videos.
```bash
cd frontend
npm install   # Only needed the first time
npm run dev
```
*The frontend will run on `http://localhost:5173`*

---

## Usage

1. Once all three servers are running, open your web browser and navigate to `http://localhost:5173`.
2. Paste a YouTube URL or upload an MP4 video file.
3. Click "Generate Viral Clips".
4. The system will process the video and return the viral short clips!

## Prerequisites
Ensure you have the following installed on your machine:
- **Node.js** (v18+)
- **Python** (v3.10+)
- **FFmpeg**: Must be installed and added to your system's PATH.
