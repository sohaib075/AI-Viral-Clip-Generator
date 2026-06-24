# 🚀 AI Viral Clip Generator

An automated, end-to-end AI pipeline that converts long-form YouTube videos (or local uploads) into highly engaging, viral short-form clips suitable for TikTok, Instagram Reels, and YouTube Shorts.

![Viral Clips](https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&auto=format&fit=crop&q=80&ixlib=rb-4.0.3)

## ✨ Features

- **Lightning-Fast Video Downloading**: Utilizes heavily-optimized `yt-dlp` with Node.js JS-runtime extraction to fetch videos at maximum speeds.
- **Parallel Audio Transcription**: Splits audio into chunks and transcribes them simultaneously using the blazing-fast Groq API (`whisper-large-v3`), guaranteeing near-instant, highly accurate results with zero timestamp drift.
- **AI-Powered Viral NLP Highlighting**: Leverages Google's `gemini-2.5-flash` to intelligently analyze transcripts. It prioritizes contextual completeness and viral potential over mere quantity, dynamically adjusting clip lengths.
- **Automated Video Editing**: Uses pure `ffmpeg-python` for lightning-fast, single-pass video cutting. It preserves the original aspect ratio to ensure no strange cropping or stretching.
- **Dynamic Synchronized Subtitles**: Automatically generates and burns real-time, phrase-by-phrase subtitles into the clips—keeping viewers engaged.
- **Persistent Project Dashboard**: A beautiful, modern React frontend that tracks your jobs, saves your generated clips, and allows you to download or view full video transcripts.

## 🏗️ Architecture Stack

The project is split into three decoupled services:
1. **Frontend**: React + TypeScript + Vite + Tailwind CSS (Lucide Icons)
2. **Node.js Backend**: Express API that manages file uploads, stores persistent job data (`jobs.json`), and proxies requests to the AI engine.
3. **Python AI Pipeline**: A Flask microservice that orchestrates `yt-dlp`, FFmpeg, the Groq API, and the Gemini API.

---

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v18+)
- Python (3.9+)
- FFmpeg (Installed and added to your system PATH)
- API Keys for **Groq** and **Google Gemini**

### 1. Python AI Pipeline Setup

Navigate to the `python-pipeline` directory:
```bash
cd python-pipeline
```

Install the required Python packages:
```bash
pip install flask groq google-genai yt-dlp ffmpeg-python imageio-ffmpeg python-dotenv
```

Create a `.env` file in the `python-pipeline` directory with your API keys:
```env
GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

Start the Python engine:
```bash
python app.py
```
*Runs on `http://localhost:5001`*

### 2. Node.js Backend Setup

Navigate to the `backend` directory:
```bash
cd backend
```

Install dependencies:
```bash
npm install express cors multer
```

Start the backend proxy server:
```bash
node index.js
```
*Runs on `http://localhost:5000`*

### 3. Frontend Setup

Navigate to the `frontend` directory:
```bash
cd frontend
```

Install dependencies:
```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
```
*Runs on `http://localhost:5173`*

---

## 💡 How it Works

1. **Upload**: Paste a YouTube URL (or upload a local file) into the React dashboard.
2. **Download & Extract**: The Node backend passes the job to the Python engine. The video is downloaded and the audio is compressed to a 32kbps MP3 to bypass API file limits.
3. **Chunking & Transcription**: The audio is instantly chunked into 5-minute segments and sent concurrently to the Groq Whisper API for extreme speed.
4. **NLP Highlights**: The full transcript is sent to Google Gemini, which isolates the most meaningful and engaging highlights.
5. **Subtitle Generation**: Phrase-level timestamps from Whisper are precisely mapped and offset to fit the boundaries of the cut clips.
6. **Final Render**: FFmpeg simultaneously cuts the video, preserves the dimensions, and burns the generated subtitles into the video.
7. **Delivery**: The completed clips, viral scores, and the full text transcript are delivered directly to the frontend.

## ⚠️ Disclaimer & Copyright Notice
Please ensure you have the proper rights or permissions to use, modify, and distribute the content you are processing. Generating AI clips from copyrighted material without permission may violate platform policies (TikTok, YouTube, Instagram) and result in copyright strikes.
