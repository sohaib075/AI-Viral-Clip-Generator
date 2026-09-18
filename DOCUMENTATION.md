# ClipGenius — Complete Project Documentation

**AI Viral Clip Generator** (product name in the UI: **ClipGenius**) is a self-hosted pipeline that turns long-form video (or text) into short, captioned clips and can publish them to social platforms.

This document covers architecture, setup, APIs, the web design system, mobile app, Docker, security, and operations.

---

## Table of contents

1. [Overview](#1-overview)
2. [System architecture](#2-system-architecture)
3. [Repository layout](#3-repository-layout)
4. [Prerequisites](#4-prerequisites)
5. [Local setup](#5-local-setup)
6. [Environment variables](#6-environment-variables)
7. [Web application](#7-web-application)
8. [UI design system](#8-ui-design-system)
9. [Backend API reference](#9-backend-api-reference)
10. [Python AI pipeline](#10-python-ai-pipeline)
11. [Job types & file conventions](#11-job-types--file-conventions)
12. [Publishing & social accounts](#12-publishing--social-accounts)
13. [Mobile app](#13-mobile-app)
14. [Docker deployment](#14-docker-deployment)
15. [Security model](#15-security-model)
16. [Operations & troubleshooting](#16-operations--troubleshooting)
17. [Disclaimer](#17-disclaimer)

---

## 1. Overview

### What it does

| Capability | Description |
|------------|-------------|
| **Viral clips** | Download or upload a long video → transcribe → AI highlight detection → crop + burn captions |
| **Auto edit** | AI selects usable segments, applies zooms/color, captions; returns restylable base + final |
| **Story to video** | Text → scenes + image prompts + TTS narration → composed video |
| **Caption restyle** | Re-burn ASS captions on a base clip with custom theme/colors/size/position |
| **Publish** | Connect YouTube, TikTok, Instagram, X → schedule or post now → background queue |

### Tech stack

| Layer | Stack |
|-------|--------|
| Web UI | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide icons |
| Mobile | Expo (React Native), Expo Router, NativeWind |
| API | Node.js, Express 5, SQLite (`scheduler.db`), Multer |
| AI engine | Python 3.10+, Flask, yt-dlp, FFmpeg, Groq, Google Gemini, edge-tts, MoviePy |

### Default ports

| Service | Port |
|---------|------|
| Web (Vite dev) | `5173` |
| Backend | `5000` |
| Python pipeline | `5001` |
| Web (Docker nginx) | `80` (also `5173:80`) |

---

## 2. System architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Web (React)    │     │  Backend (Express)   │     │  Python pipeline    │
│  Mobile (Expo)  │────▶│  • uploads           │────▶│  • download/transcribe│
│                 │     │  • jobs.json         │     │  • Gemini / Groq    │
│                 │◀────│  • scheduler.db      │◀────│  • FFmpeg render    │
│                 │     │  • OAuth + queue      │     │  • story videos     │
└─────────────────┘     │  • /temp media       │     └─────────────────────┘
                        └──────────────────────┘
                                   │
                                   ▼
                        Shared volume: temp/
```

- Clients talk **only** to the Node backend.
- The backend proxies long-running AI work to Flask and stores job summaries + publishing state.
- Rendered media lives under `temp/Clips` and `temp/StoryVideos` and is served at `/temp/...`.

---

## 3. Repository layout

```
AI-Viral-Clip-Generator/
├── frontend/           # ClipGenius web dashboard (Vite + React)
├── backend/            # Express API, OAuth, publish queue
├── python-pipeline/    # Flask AI / FFmpeg microservice
├── mobile-app/         # Expo mobile client
├── temp/               # Shared media workspace (gitignored content)
├── docker-compose.yml
├── README.md
└── DOCUMENTATION.md    # This file
```

### Frontend (`frontend/src`)

| Path | Role |
|------|------|
| `App.tsx` | Router + shell (sidebar, navbar) |
| `index.css` | Design tokens & utility classes |
| `nav.tsx` | Shared main navigation |
| `components/` | Sidebar, Navbar, AuthGate, ui primitives, ErrorBoundary |
| `pages/` | Dashboard, Auto Edit, Story, Results, Projects, Queue, etc. |
| `api.ts` | Authenticated `fetch` + `mediaUrl` |
| `types.ts` | Shared TypeScript contracts |

### Backend (`backend/`)

| Path | Role |
|------|------|
| `index.js` | HTTP routes, uploads, job proxy |
| `db.js` | SQLite schema & migrations |
| `queue.js` | Background publisher |
| `auth.js` | OAuth flows |
| `security.js` | Origins, hosts, API token |
| `paths.js` | Temp dirs, media URL → disk |
| `uploaders/` | YouTube, TikTok, Instagram, X |
| `data/` | `jobs.json` (summaries), `jobs/<id>.json` (clips + transcript), `scheduler.db` |

### Python (`python-pipeline/`)

| Module | Role |
|--------|------|
| `app.py` | Flask routes & job orchestration |
| `downloader.py` | yt-dlp + local `file://` uploads |
| `transcriber.py` | Groq Whisper |
| `nlp_highlight.py` | Gemini viral highlights |
| `video_editor.py` | Cut, crop, ASS captions |
| `advanced_editor.py` | Auto Edit plan + render |
| `story_video_maker.py` | Story → video |
| `style_configs.json` | Caption / grade presets |

---

## 4. Prerequisites

- **Node.js** 20+
- **Python** 3.10+
- **FFmpeg** (+ `ffprobe`) on `PATH` (required for rendering and publish validation)
- API keys:
  - [Groq](https://console.groq.com) — transcription & story LLM
  - [Google AI Studio / Gemini](https://aistudio.google.com/) — highlights & auto-edit analysis
- Optional for publishing: OAuth apps for YouTube, X, TikTok, Instagram; stable `ENCRYPTION_KEY`

---

## 5. Local setup

### 5.1 Python pipeline

```bash
cd python-pipeline
pip install -r requirements.txt
cp .env.example .env
# Edit GROQ_API_KEY and GEMINI_API_KEY
python app.py
# → http://127.0.0.1:5001
```

### 5.2 Backend

```bash
cd backend
npm install
cp .env.example .env
# Optional: API_TOKEN, ENCRYPTION_KEY, OAuth credentials
node index.js
# → http://localhost:5000
```

### 5.3 Web frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

By default the web app calls `http://localhost:5000` (`VITE_API_URL` or that fallback in development).

### 5.4 Mobile (optional)

See [§13 Mobile app](#13-mobile-app) and `mobile-app/README.md`.

---

## 6. Environment variables

### Backend (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default `5000`) |
| `PYTHON_API_URL` | Flask base URL |
| `BASE_URL` | Public backend URL (OAuth redirects; must reach phones for mobile connect) |
| `FRONTEND_URL` | Web origin for CORS / allowlists |
| `API_TOKEN` | Optional Bearer token for `/api` and `/temp` |
| `ALLOWED_ORIGINS` | Extra browser origins (comma-separated) |
| `ALLOWED_HOSTS` | Extra Host header names |
| `MAX_UPLOAD_MB` | Upload size limit (default `2048`) |
| `MAX_JOB_HISTORY` | Cap for `data/jobs.json` (default `500`); dropped jobs' detail files are deleted too |
| `ENCRYPTION_KEY` | 64 hex chars; encrypts stored OAuth tokens |
| `MOBILE_APP_SCHEME` | Deep-link scheme after OAuth |
| `YOUTUBE_*` / `X_*` / `TIKTOK_*` / `INSTAGRAM_*` | Platform OAuth |

Generate helpers:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"  # API_TOKEN
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"         # ENCRYPTION_KEY
```

### Python (`python-pipeline/.env`)

| Variable | Purpose |
|----------|---------|
| `GROQ_API_KEY` | Required for Whisper / story LLM |
| `GEMINI_API_KEY` | Required for highlights / auto-edit |
| `MAX_CONCURRENT_JOBS` | Parallel jobs (default `2`) |
| `ALLOW_PRIVATE_URLS` | `1` to allow private-network downloads |
| `OUTPUT_RETENTION_DAYS` | Delete clips/uploads/logs older than N days (unset = keep forever) |
| `FLASK_HOST` | Bind address (`0.0.0.0` in Docker) |
| `PORT` | Listen port (default `5001`) |
| `FLASK_DEBUG` | Never enable on shared hosts |

### Frontend build

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend origin. Empty string in Docker = same-origin via nginx |

### Mobile / EAS

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | Backend the phone can reach (required for production builds) |
| `EXPO_PUBLIC_API_TOKEN` | Optional baked-in token |

---

## 7. Web application

### Routes

| Path | Page |
|------|------|
| `/` | Dashboard — new viral clip job + stats + recent jobs |
| `/auto-edit` | Professional auto editor |
| `/story-to-video` | Text → narrated video |
| `/processing/:jobId` | Live progress |
| `/results/:jobId` | Preview, caption customizer, social pack, publish |
| `/projects` | Job history |
| `/accounts` | Connect / disconnect platforms |
| `/queue` | Publishing queue |
| `/analytics` | KPIs and breakdowns |
| `/settings` | Server status + access token |
| `/how-it-works` | Pipeline explanation |

### Client auth

- On load, `AuthGate` calls `GET /api/session`.
- If `tokenRequired` and not authenticated, the user enters `API_TOKEN` (stored in `localStorage`).
- API calls send `Authorization: Bearer <token>`.
- Media URLs append `?access_token=` so `<video>` / `<img>` work without custom headers.
- Tokens are stripped before storing publish `clip_url` values in the database.

### Typical clip flow

1. User submits URL or file on Dashboard → `POST /api/jobs`.
2. Navigate to `/processing/:jobId` (polls `GET /api/jobs/:id`).
3. On completion → `/results/:jobId`.
4. Optional: adjust captions → `POST /api/export`.
5. Optional: publish → `POST /api/posts` → monitor `/queue`.

---

## 8. UI design system

The web UI uses a **studio** aesthetic (warm charcoal, ember accent), not generic purple/glass AI styling.

### Brand & type

| Token | Value |
|-------|--------|
| Product name | ClipGenius |
| Display font | **Syne** (`--font-display`) |
| UI font | **Figtree** (`--font-sans`) |
| Accent | `#e85d3b` (`--color-accent`) |

### Color tokens (`frontend/src/index.css`)

| Token | Hex / value | Use |
|-------|-------------|-----|
| `--color-canvas` | `#0e0d0c` | Page background |
| `--color-surface` | `#171513` | Panels |
| `--color-surface-2` | `#1f1c19` | Raised panels |
| `--color-border` | `#2e2a26` | Default borders |
| `--color-border-strong` | `#453f38` | Emphasized borders |
| `--color-ink` | `#f4f0ea` | Primary text |
| `--color-muted` | `#9a9288` | Secondary text |
| `--color-faint` | `#6b645c` | Labels / hints |
| `--color-accent` | `#e85d3b` | Primary actions, active nav |
| `--color-ok` | `#3d9a6a` | Success |
| `--color-warn` | `#c9a227` | Warnings |
| `--color-danger` | `#d4534a` | Errors |

### CSS utilities

| Class | Purpose |
|-------|---------|
| `page-shell` | Page padding / layout wrapper |
| `page-title` / `page-subtitle` | Page headings |
| `panel` / `panel-raised` | Solid studio cards |
| `glass-panel` | Alias → same as `panel` (compat) |
| `field-label` / `field-input` | Forms |
| `btn-primary` / `btn-secondary` / `btn-ghost` | Buttons |
| `alert-error` / `alert-warn` | Inline alerts |
| `studio-bg` | Soft radial background wash |

### Shared React pieces

- `components/ui.tsx` — `PageHeader`, `Panel`
- `nav.tsx` — `MAIN_NAV`, `GITHUB_URL`
- Prefer tokens and utilities over one-off hex colors (especially avoid cyan/teal leftovers).

---

## 9. Backend API reference

Unless noted, routes under `/api` require `Authorization: Bearer <API_TOKEN>` when `API_TOKEN` is set.

Media under `/temp/Clips` and `/temp/StoryVideos` also require the token (header or `?access_token=`).

### Session & auth

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/session` | `{ tokenRequired, authenticated }` — public |
| `POST` | `/api/oauth/ticket` | One-time ticket for browser OAuth |
| `*` | `/auth/:platform` | OAuth start/callback (ticket-based) |

### Jobs

| Method | Path | Body / notes |
|--------|------|----------------|
| `POST` | `/api/jobs` | JSON `{ videoUrl, layout }` or multipart `video` + `layout` (`vertical` \| `horizontal`) |
| `POST` | `/api/auto-edit` | URL or file + `layout` (`9:16`\|`16:9`\|`1:1`), `style`, `prompt` |
| `POST` | `/api/story-to-video` | `{ story, style, voice, aspectRatio }` |
| `GET` | `/api/jobs` | Job history summaries |
| `GET` | `/api/jobs/:id` | Status (+ clips when complete) |
| `POST` | `/api/export` | Restyle captions: `{ clipUrl, styleConfig, clipData }` (10 min timeout) |
| `GET` | `/api/analytics` | Aggregated stats |

### Accounts & queue

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/accounts` | Connected accounts |
| `DELETE` | `/api/accounts/:id` | Disconnect |
| `GET` | `/api/posts` | Queue |
| `POST` | `/api/posts` | Schedule publish (`clip_url`, `platforms`, metadata, `scheduled_time`) |
| `POST` | `/api/posts/:id/retry` | Retry failed platforms |
| `DELETE` | `/api/posts/:id` | Remove pending/failed |

### Job status shape (from pipeline / saved history)

```json
{
  "status": "processing | completed | failed",
  "progress": 0,
  "message": "...",
  "clips": [
    {
      "title": "...",
      "video_url": "/temp/Clips/....mp4",
      "base_url": "/temp/Clips/...._base.mp4",
      "thumbnail_url": "/temp/Clips/....jpg",
      "words": [],
      "segments": [],
      "metadata": {},
      "layout": "vertical"
    }
  ],
  "warnings": []
}
```

---

## 10. Python AI pipeline

Internal service; normally only the backend calls it.

| Method | Path | Role |
|--------|------|------|
| `GET` | `/health` | Liveness |
| `POST` | `/api/process` | Viral clip job |
| `POST` | `/api/auto-edit` | Auto Edit job |
| `POST` | `/api/story-to-video` | Story job |
| `GET` | `/api/status/<job_id>` | Progress / result |
| `POST` | `/api/export` | Burn custom ASS on a `*_base.mp4` |

### Viral clip pipeline (high level)

1. Download or resolve local upload → `temp/Input`
2. Extract audio → Whisper (chunked, parallel) on Groq
3. Gemini selects highlights + social copy
4. FFmpeg: cut, crop/scale, burn ASS, thumbnail
5. Return clip URLs + word timings for restyle

### Auto Edit

1. Transcribe full video  
2. Gemini returns `kept_segment_indices` / `zoom_indices` (coerced to ints)  
3. Concat kept segments with optional punch-in zoom + color grade  
4. Keep `advanced_<jobId>_base.mp4` and `advanced_<jobId>_final.mp4` for restyle  

### Story to video

1. LLM splits story into scenes + image prompts  
2. Pollinations images + edge-tts narration  
3. Compose with FFmpeg / MoviePy → `temp/StoryVideos`

---

## 11. Job types & file conventions

### Job types

| `type` | Source |
|--------|--------|
| `clips` | Dashboard viral clips |
| `auto_edit` | Auto Video Editor |
| `story_to_video` | Story to Video |

### Shared `temp/` tree

```
temp/
├── Input/        # Uploads & downloads (cleaned after job)
├── Processed/    # Transcripts; temp audio
├── Clips/        # Public clip outputs & thumbnails
├── Subtitles/    # SRT (not HTTP-served)
├── StoryVideos/  # Public story outputs
└── Logs/         # Per-job logs (not HTTP-served)
```

### Clip naming

| Asset | Pattern |
|-------|---------|
| Base (no captions) | `Clip_[NN]_[slug]_[jobId]_base.mp4` |
| Final | `Clip_[NN]_[slug]_[jobId]_final.mp4` |
| Auto Edit base/final | `advanced_[jobId]_base.mp4` / `_final.mp4` |
| Thumbnail | `Thumbnail_[NN]_[slug]_[jobId].jpg` |
| Log | `Logs/[jobId].log` |

Only `Clips/` and `StoryVideos/` are served over HTTP.

---

## 12. Publishing & social accounts

### Supported platforms

YouTube Shorts, TikTok, Instagram Reels, X (Twitter).

LinkedIn appears in the **Social Pack** as **copy-only** (not a publish target).

### Flow

1. Connect accounts on `/accounts` (OAuth; tokens encrypted at rest with `ENCRYPTION_KEY`).
2. From Results, choose platforms, title/description/hashtags, schedule.
3. `queue.js` worker picks due posts, validates with `ffprobe`, uploads, records per-platform results.
4. Duplicate lock: SHA-256 of the file × platform — never auto-upload the same file twice to one platform.
5. Temporary failures retry (capped); unclear outcomes are not auto-retried (user can Retry).

### OAuth redirect URLs (examples)

Use `${BASE_URL}` from backend env:

- YouTube: `/auth/youtube/callback`
- X: `/auth/x/callback`
- TikTok: `/auth/tiktok/callback`
- Instagram: `/auth/instagram/callback`

---

## 13. Mobile app

Expo app under `mobile-app/` mirrors core web flows (create, process, results, queue, story, settings).

### Dev

```bash
cd mobile-app
npm install
npx expo start
```

Dev builds resolve the backend via Expo host IP → port `5000`, or Android emulator `10.0.2.2:5000`.

### Standalone builds

Set `EXPO_PUBLIC_API_URL` in `eas.json`:

- **preview** — typically a LAN `http://…:5000`
- **production** — must be set (HTTPS recommended); build fails if missing

Cleartext HTTP is allowed only when the configured URL is `http://` (see `plugins/with-cleartext-http.js`).

Access token: Settings, or `EXPO_PUBLIC_API_TOKEN`. For OAuth from the phone, `BASE_URL` on the backend must be reachable from the device.

---

## 14. Docker deployment

```bash
# Ensure python-pipeline/.env and backend/.env exist
docker compose up --build
```

| Service | Notes |
|---------|--------|
| `python-pipeline` | Bound to `127.0.0.1:5001` on the host |
| `backend` | Port `5000`; `PYTHON_API_URL=http://python-pipeline:5001` |
| `frontend` | nginx on `80` / `5173`; proxies `/api`, `/auth`, `/temp` to backend; `VITE_API_URL` empty (same-origin) |

Volumes: `./temp` shared; `./backend/data` persists jobs DB + history.

Same-host UI+API through nginx allows browser origins that match an allowed Host (LAN IP usage works when the Host is an IP or listed name).

---

## 15. Security model

| Control | Behavior |
|---------|----------|
| **API token** | Optional; gates `/api/*` and public media |
| **CORS / Origin** | Localhost always allowed; plus `FRONTEND_URL` / `ALLOWED_ORIGINS`; same-host UI allowed when Host is allowed |
| **Host allowlist** | Mitigates DNS rebinding; IPs always OK |
| **Media** | Only `Clips` + `StoryVideos`; require token when configured |
| **Uploads** | Video MIME/extension filter; size limit; stored under `temp/Input` |
| **Local paths** | Clients cannot pass arbitrary filesystem paths — only server-built `file://` after upload |
| **OAuth secrets** | Encrypted with `ENCRYPTION_KEY` |
| **Private URLs** | Download of private-network hosts blocked unless `ALLOW_PRIVATE_URLS=1`. Checked before the download only — yt-dlp follows redirects and re-resolves DNS itself, so a public host redirecting to a private one is still reachable. Don't give the pipeline a route to anything sensitive if untrusted people can submit URLs. |
| **Job history** | Trimmed to `MAX_JOB_HISTORY`; clips/transcripts kept in `backend/data/jobs/<id>.json` |

---

## 16. Operations & troubleshooting

| Symptom | Check |
|---------|--------|
| Web “could not reach server” | Backend on `:5000`; `VITE_API_URL` / CORS / `ALLOWED_ORIGINS` |
| Jobs fail immediately | Python on `:5001`; `GROQ_API_KEY` / `GEMINI_API_KEY`; FFmpeg on PATH |
| 401 / auth gate | `API_TOKEN` mismatch; Settings → save token |
| Videos don’t play with token | Ensure `mediaUrl` / `?access_token=` (web & mobile do this) |
| OAuth fails | `ENCRYPTION_KEY`, client IDs/secrets, redirect URLs, reachable `BASE_URL` |
| Mobile can’t connect | `EXPO_PUBLIC_API_URL`, same Wi‑Fi, cleartext plugin for `http://` |
| Docker UI API errors | Rebuild frontend with empty `VITE_API_URL`; open via the nginx port, not Vite alone |
| Auto Edit “no usable parts” | Gemini index coercion is in place; check logs under `temp/Logs` |
| Publish OOM on X | Uploader streams from disk in chunks; still respect platform size limits |
| DB init failure | Backend exits on SQLite init error — fix `backend/data` permissions |

### Useful commands

```bash
# Web production build
cd frontend && npm run build

# Backend syntax check
cd backend && node --check index.js

# Python compile check
cd python-pipeline && python -m py_compile app.py
```

---

## 17. Disclaimer

Only process and publish content you have the rights to use. Generating or uploading clips from copyrighted material without permission may violate platform policies and copyright law. Compliance is the operator’s responsibility.

---

*ClipGenius / AI Viral Clip Generator — project documentation.*
