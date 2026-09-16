# ClipGenius — AI Viral Clip Generator

Self-hosted pipeline that turns long-form video (or text) into short, captioned clips and can publish them to YouTube Shorts, TikTok, Instagram Reels, and X.

**Full reference:** [DOCUMENTATION.md](./DOCUMENTATION.md)

---

## Features

- **Viral clips** — Download or upload → Whisper transcription (Groq) → Gemini highlights → FFmpeg crop + animated ASS captions
- **Auto Edit** — AI storyline cut with zooms, color grade, captions; restylable base clip
- **Story to Video** — Script/chapter → scenes, AI images, TTS narration, composed video
- **Caption customizer** — Themes, colors, size, position; re-export without re-cutting
- **Publishing queue** — OAuth connect, schedule/post now, retries, per-platform duplicate lock
- **Clients** — Studio web dashboard (React) + Expo mobile app

---

## Architecture

| Service | Role | Default |
|---------|------|---------|
| **Frontend** | React + TypeScript + Vite + Tailwind | `http://localhost:5173` |
| **Backend** | Express API, uploads, jobs, OAuth, queue | `http://localhost:5000` |
| **Python pipeline** | yt-dlp, Groq, Gemini, FFmpeg | `http://127.0.0.1:5001` |

Shared media workspace: `temp/` (only `Clips/` and `StoryVideos/` are HTTP-served).

---

## Quick start

**Prerequisites:** Node 20+, Python 3.10+, FFmpeg (+ ffprobe) on PATH, Groq + Gemini API keys.

```bash
# 1. AI engine
cd python-pipeline
pip install -r requirements.txt
cp .env.example .env   # set GROQ_API_KEY, GEMINI_API_KEY
python app.py

# 2. API
cd ../backend
npm install
cp .env.example .env   # optional API_TOKEN, OAuth, ENCRYPTION_KEY
node index.js

# 3. Web UI
cd ../frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

**Docker:** configure `python-pipeline/.env` and `backend/.env`, then `docker compose up --build`. The frontend nginx proxies `/api`, `/auth`, and `/temp` to the backend (same-origin).

**Mobile:** see [mobile-app/README.md](./mobile-app/README.md) and [DOCUMENTATION.md §13](./DOCUMENTATION.md#13-mobile-app).

---

## Web UI (studio design)

- Fonts: **Syne** (headings) + **Figtree** (UI)
- Warm charcoal surfaces, ember accent `#e85d3b`
- Shared tokens/utilities in `frontend/src/index.css` (`panel`, `btn-primary`, `field-input`, …)

Details: [DOCUMENTATION.md §8](./DOCUMENTATION.md#8-ui-design-system).

---

## Documentation map

| Doc | Contents |
|-----|----------|
| [DOCUMENTATION.md](./DOCUMENTATION.md) | Complete project guide (API, env, security, Docker, troubleshooting) |
| [mobile-app/README.md](./mobile-app/README.md) | Expo setup, EAS URLs, tokens |
| `backend/.env.example` | Backend configuration reference |
| `python-pipeline/.env.example` | Pipeline keys and options |

---

## Disclaimer

Only process and publish content you have rights to use. Copyright and platform-policy compliance are your responsibility.
