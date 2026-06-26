# 🚀 AI Viral Clip Generator

An automated, end-to-end AI pipeline that converts long-form landscape videos (or local uploads) into highly engaging, viral short-form clips suitable for TikTok, Instagram Reels, YouTube Shorts, and standard widescreen formats.

![Viral Clips](https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&auto=format&fit=crop&q=80&ixlib=rb-4.0.3)

---

## ✨ Features

- **Lightning-Fast Video Downloading**: Utilizes heavily-optimized `yt-dlp` to fetch videos at maximum speeds, constrained up to `1080p` for high-quality cropping.
- **Parallel Audio Transcription**: Splits audio into chunks and transcribes them simultaneously using the blazing-fast Groq API (`whisper-large-v3`), guaranteeing near-instant, highly accurate results with zero timestamp drift.
- **AI-Powered Viral NLP Highlighting**: Leverages Google's `gemini-2.5-flash` to intelligently analyze transcripts. It prioritizes contextual completeness and viral potential over mere quantity, dynamically adjusting clip lengths.
- **Adaptive Layout Formats**: Supports dual aspect-ratio rendering:
  - **9:16 Vertical Crop**: Centered crop and scale to `1080x1920` optimal for TikTok, Instagram Reels, and YouTube Shorts.
  - **16:9 Horizontal Scale**: Standard standard widescreen scale to `1920x1080` for standard web players.
- **Premium Animated captions (ASS)**: Automatically generates and burns real-time, animated subtitles utilizing Advanced SubStation Alpha (`.ass`) styling:
  - **Bold Meme-Style Typography**: Renders in thick, bold **Arial Black** font with high-contrast black outline and drop shadow.
  - **Progressive Word-Level Highlighting**: The active spoken word dynamically turns bright **Yellow** and pops out with a **15% size zoom** (`\fscx115\fscy115`) while spoken, keeping other words white.
  - **Timing Proportional Allocation**: Timestamps are dynamically calculated based on word character length (excluding punctuation) to match spoken tempos naturally.
  - **Pause Padding**: Automatically detects punctuation (periods, commas, question marks) and adds custom pause weights to absorb silence and prevent caption drift.
  - **Automatic Verification**: Clamps subtitle timestamps within clip boundaries, resolves overlaps, and enforces a minimum 50ms duration check.
  - **Adaptive Margins**: Subtitles are positioned high enough on vertical layouts (`MarginV=500` from bottom) to avoid TikTok UI overlays, and at the bottom (`MarginV=80`) for widescreen.
- **Automated Thumbnail Extraction**: Uses FFmpeg to extract a preview frame from the first second of each rendered clip, automatically binding it to project cards.
- **Persistent Project Dashboard**: A beautiful, modern React frontend featuring:
  - An **inline vertical video player preview** that autoplays chosen clips.
  - Interactive **subtitle track segments** synced to the active clip.
  - Dynamic **AI Virality Explanation** card.
  - Step-by-step pipeline logging displays.

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
