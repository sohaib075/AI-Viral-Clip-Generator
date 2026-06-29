# 🚀 AI Viral Clip Generator

An automated, end-to-end AI pipeline that converts long-form landscape videos (or local uploads) into highly engaging, viral short-form clips suitable for TikTok, Instagram Reels, YouTube Shorts, and standard widescreen formats.

![Viral Clips](https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&auto=format&fit=crop&q=80&ixlib=rb-4.0.3)

---

## ✨ Features

- **Lightning-Fast Video Downloading**: Utilizes a robust, heavily-optimized `yt-dlp` engine. Features an advanced fallback chain (including Android client spoofing and local browser cookie extraction) to automatically bypass bot detection and age restrictions, constrainted up to `1080p` for high-quality cropping.
- **Parallel Audio Transcription**: Splits audio into chunks and transcribes them simultaneously using the blazing-fast Groq API (`whisper-large-v3`), guaranteeing near-instant, highly accurate results with zero timestamp drift.
- **AI-Powered Viral NLP Highlighting**: Leverages Google's `gemini-2.5-flash` to intelligently analyze transcripts. It prioritizes contextual completeness and viral potential over mere quantity, dynamically adjusting clip lengths.
- **Adaptive Layout Formats**: Supports dual aspect-ratio rendering:
  - **9:16 Vertical Crop**: Centered crop and scale to `1080x1920` optimal for TikTok, Instagram Reels, and YouTube Shorts.
  - **16:9 Horizontal Scale**: Standard widescreen scale to `1920x1080` for standard web players.
- **Premium Animated captions (ASS)**: Automatically generates and burns real-time, animated subtitles utilizing Advanced SubStation Alpha (`.ass`) styling:
  - **Customizable Themes**: Choose from Modern, Viral, Podcast, or Gaming styles with fully customizable text colors, highlight colors, font size, and vertical margins directly from the UI.
  - **Progressive Word-Level Highlighting**: The active spoken word pops out dynamically while spoken, keeping other words white.
  - **Timing Proportional Allocation**: Timestamps are dynamically calculated based on word character length (excluding punctuation) to match spoken tempos naturally.
- **AI Story-to-Video Generator**: Transform text, scripts, or novel chapters into complete, fully narrated videos.
  - **LLM Scene Detection**: Intelligently analyzes your text using Groq (`llama-3.3-70b-versatile`) to break it down into dynamic scenes and generate creative image prompts and narration.
  - **Free AI Visuals**: Leverages Pollinations.ai for generating high-quality scene images across various art styles (Cinematic, Anime, Cyberpunk, 3D, Cartoon, etc).
  - **Realistic Text-to-Speech**: Integrates `edge-tts` to generate high-quality, human-like voiceovers.
  - **Automated Composition**: Stitches images and audio together automatically with FFmpeg and MoviePy.
- **Automated Social Media Publisher Pipeline**:
  - **Smart Queueing System**: Schedule posts to automatically go live immediately or in the future across YouTube Shorts, Instagram Reels, and TikTok. 
  - **Global Duplicate Prevention**: Features a strict SHA-256 video fingerprinting system. The backend validates a unique `video_hash` against the database to guarantee that a video is never accidentally uploaded twice globally across any platform.
  - **Robust Background Worker**: A dedicated background Node.js worker atomically polls the queue, gracefully handles API ratelimits, implements automatic retries, and records success/failure states without overlapping execution threads.
- **"Minimalist Stealth" React Dashboard**: A beautiful, completely overhauled React frontend featuring:
  - A premium, developer-focused dark mode aesthetic utilizing translucent glassmorphic panels and subtle micro-animations.
  - An **inline vertical video player preview** and fully-featured **Caption Customizer**.
  - Dynamic **AI Social Media Pack** card offering ready-to-copy titles, descriptions, and hashtags.
  - A comprehensive **Publishing Queue** table to track post statuses in real-time.

---

## 🏗️ Architecture Stack

The project is split into three decoupled services:
1. **Frontend**: React + TypeScript + Vite + Tailwind CSS (Lucide Icons)
2. **Node.js Backend**: Express API that manages file uploads, stores persistent job data (`jobs.json`), and proxies requests to the AI engine.
3. **Python AI Pipeline**: A Flask microservice that orchestrates `yt-dlp`, FFmpeg, the Groq API, and the Gemini API.

---

## 📂 Structural File Organization

All inputs, intermediates, and outputs are systematically organized inside subdirectories under the `temp/` folder:

```
temp/
├── Input/       (Raw downloaded video files and user uploads)
├── Processed/   (Compressed MP3 audio tracks and Transcript_[JobId].json)
├── Clips/       (Vertical portrait or horizontal MP4s and Thumbnail_[Seq]_[JobId].jpgs)
├── Subtitles/   (Generated Sub_[Seq]_[JobId].srt and animated Sub_[Seq]_[JobId].ass subtitle tracks)
├── StoryVideos/ (Fully generated AI Story-to-Video output files)
└── Logs/        (Live timestamped job-specific execution logs [JobId].log)
```

### Filename Naming Conventions
To maintain scalability and prevent file overwriting, assets are automatically saved using clear, descriptive, and unique names:
* **Generated Video Clip**: `Clip_[Seq]_[Slugified_Title]_[JobId].mp4`
* **Subtitles ASS File**: `Sub_[Seq]_[Slugified_Title]_[JobId].ass`
* **Subtitles SRT File**: `Sub_[Seq]_[Slugified_Title]_[JobId].srt`
* **Clip Thumbnail Image**: `Thumbnail_[Seq]_[Slugified_Title]_[JobId].jpg`
* **Job Log File**: `Logs/[JobId].log`

---

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- FFmpeg (Installed and added to your system PATH)
- API Keys for **Groq** and **Google Gemini**

### 1. Python AI Pipeline Setup

Navigate to the `python-pipeline` directory:
```bash
cd python-pipeline
```

Install the required Python packages:
```bash
pip install flask groq google-genai yt-dlp ffmpeg-python imageio-ffmpeg python-dotenv edge-tts moviepy requests
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
npm install express cors multer dotenv
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

1. **Upload**: Paste a YouTube URL (or upload a local file) into the React dashboard, choosing either **9:16 Vertical** or **16:9 Horizontal** target format.
2. **Download & Extract**: The Node backend saves uploads directly to `temp/Input` and queries the Python engine. The video is downloaded to `temp/Input` and its audio compressed to a 32kbps MP3 inside `temp/Processed/`.
3. **Chunking & Transcription**: The audio is instantly chunked into 5-minute segments and sent concurrently to the Groq Whisper API for extreme speed.
4. **NLP Highlights**: The full transcript is sent to Google Gemini, which isolates the most meaningful and engaging highlights.
5. **Caption Compile**: The pipeline formats subtitles into Advanced SubStation Alpha (`.ass`), calculates proportional character timings and pause paddings, and checks bounds.
6. **Final Render**: FFmpeg simultaneously cuts the video, scales/crops based on layout format, and burns the generated ASS subtitles. It also extracts a JPEG thumbnail at the `1.0s` mark.
7. **Delivery**: The completed clips, dynamic thumbnails, and the full transcript are mapped and returned to the React dashboard.

---

## ⚠️ Disclaimer & Copyright Notice
Please ensure you have the proper rights or permissions to use, modify, and distribute the content you are processing. Generating AI clips from copyrighted material without permission may violate platform policies (TikTok, YouTube, Instagram) and result in copyright strikes.
