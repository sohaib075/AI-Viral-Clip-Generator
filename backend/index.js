const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomBytes } = require('crypto');
require('dotenv').config();

const db = require('./db');
const httpError = require('./httpError');
const { startQueueWorker, SUPPORTED_PLATFORMS } = require('./queue');
const { TEMP_DIR, DATA_DIR, PUBLIC_MEDIA_DIRS, resolveMediaUrl, publicMediaPath } = require('./paths');
const { isAllowedOrigin, isAllowedHost, tokenRequired, isAuthorized, requireToken } = require('./security');
const { router: authRouter, createOAuthTicket } = require('./auth');

const app = express();
const port = process.env.PORT || 5000;
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://127.0.0.1:5001';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 2048;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
    if (!isAllowedHost(req.headers.host)) {
        return res.status(403).json({ error: 'Host not allowed. Add it to ALLOWED_HOSTS.' });
    }
    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin, req.headers.host)) {
        return res.status(403).json({ error: 'Origin not allowed. Add it to ALLOWED_ORIGINS.' });
    }
    next();
});
app.use((req, res, next) => {
    cors({
        origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin, req.headers.host)),
    })(req, res, next);
});
// Export requests carry a clip's word timings, which can exceed the 100kb default
app.use(express.json({ limit: '5mb' }));

// Rendered clips and story videos. When API_TOKEN is set, require the same token
// (Authorization header or ?access_token= for <video>/<img> tags). Uploads/transcripts/logs stay private.
for (const dir of PUBLIC_MEDIA_DIRS) {
    app.use(`/temp/${dir}`, requireToken, express.static(path.join(TEMP_DIR, dir), { index: false, dotfiles: 'deny' }));
}

const isHttpUrl = (value) => {
    try {
        const { protocol } = new URL(value);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
};

const text = (value, maxLength) => (typeof value === 'string' ? value.slice(0, maxLength) : '');
const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const createId = (prefix) => `${prefix}_${Date.now()}_${randomBytes(3).toString('hex')}`;

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------
const INPUT_DIR = path.join(TEMP_DIR, 'Input');
fs.mkdirSync(INPUT_DIR, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: INPUT_DIR,
        filename: (req, file, cb) => {
            const safeName = path.basename(file.originalname).replace(/[^\w.-]+/g, '_').slice(-80);
            cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}-${safeName}`);
        }
    }),
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        const isVideo = file.mimetype.startsWith('video/') || /\.(mp4|mov|m4v|mkv|webm|avi)$/i.test(file.originalname);
        if (!isVideo) return cb(httpError(400, 'Only video files can be uploaded.'));
        cb(null, true);
    }
});

const discardUpload = (req) => {
    if (req.file) fs.rm(req.file.path, { force: true }, () => {});
};

// ---------------------------------------------------------------------------
// Job history
// ---------------------------------------------------------------------------
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const LEGACY_JOBS_FILE = path.join(__dirname, 'jobs.json');
// Cap stored history so jobs.json and memory cannot grow forever
const MAX_JOB_HISTORY = Math.max(50, Number(process.env.MAX_JOB_HISTORY) || 500);
// A 'Processing' job the AI service doesn't know about after this long was lost in a restart
const JOB_LOST_AFTER_MS = 60 * 1000;

// Clips and transcripts are stored per job, so the history file stays small and quick to rewrite
const JOB_DETAILS_DIR = path.join(DATA_DIR, 'jobs');
const detailsFile = (id) => path.join(JOB_DETAILS_DIR, `${encodeURIComponent(id)}.json`);

const readJobDetails = (id) => {
    try {
        return JSON.parse(fs.readFileSync(detailsFile(id), 'utf-8'));
    } catch (e) {
        if (e.code !== 'ENOENT') console.error(`Failed to read details for ${id}:`, e.message);
        return { clips: [], transcript: '' };
    }
};

const writeJobDetails = (id, details) => {
    try {
        fs.mkdirSync(JOB_DETAILS_DIR, { recursive: true });
        const tmpFile = `${detailsFile(id)}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(details));
        fs.renameSync(tmpFile, detailsFile(id));
    } catch (e) {
        console.error(`Failed to save details for ${id}:`, e.message);
    }
};

const readJobsFile = (file) => {
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        return Array.isArray(data) ? data : null;
    } catch (e) {
        if (e.code !== 'ENOENT') console.error(`Failed to load jobs from ${file}:`, e.message);
        return null;
    }
};

// Older versions stored placeholders ("Just now", "0:00:00", stock photos) that never changed
const normalizeJob = (job) => {
    const { time: _time, duration: _duration, ...rest } = job;
    if (typeof rest.thumbnail === 'string' && rest.thumbnail.startsWith('https://images.unsplash.com/')) {
        rest.thumbnail = null;
    }
    return rest;
};

fs.mkdirSync(DATA_DIR, { recursive: true });
const hasJobsFile = fs.existsSync(JOBS_FILE);
let migratedDetails = false;

// Older versions kept clips and transcripts inside jobs.json; move them into per-job files
const splitDetails = (job) => {
    const { clipsData, transcript, ...summary } = normalizeJob(job);
    if (clipsData || transcript) {
        writeJobDetails(summary.id, { clips: clipsData || [], transcript: transcript || '' });
        summary.scores = (clipsData || []).map(c => Number(c?.score)).filter(score => Number.isFinite(score) && score > 0);
        migratedDetails = true;
    }
    return summary;
};

let jobsHistory = (readJobsFile(JOBS_FILE) ?? readJobsFile(LEGACY_JOBS_FILE) ?? []).map(splitDetails);

// Writes to a temp file first so a crash mid-write can't corrupt the history
const saveJobs = () => {
    try {
        if (jobsHistory.length > MAX_JOB_HISTORY) {
            for (const dropped of jobsHistory.slice(MAX_JOB_HISTORY)) {
                fs.rm(detailsFile(dropped.id), { force: true }, () => {});
            }
            jobsHistory = jobsHistory.slice(0, MAX_JOB_HISTORY);
        }
        const tmpFile = `${JOBS_FILE}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(jobsHistory, null, 2));
        fs.renameSync(tmpFile, JOBS_FILE);
    } catch (e) {
        console.error('Failed to save job history:', e.message);
    }
};

// Job history used to live next to the code. Copy it into data/ (a rename fails across Docker volumes).
if ((!hasJobsFile || migratedDetails) && jobsHistory.length > 0) {
    saveJobs();
    fs.rm(LEGACY_JOBS_FILE, { force: true }, () => {});
    console.log('Moved job history into data/jobs.json');
}

const jobSummary = (job) => ({
    id: job.id,
    title: job.title,
    type: job.type || 'clips',
    status: job.status,
    clips: job.clips || 0,
    thumbnail: job.thumbnail || null,
    createdAt: job.createdAt,
    sourceDuration: job.sourceDuration ?? null,
    error: job.error || null,
    warnings: job.warnings || [],
});

// A saved job in the AI service's status format, for when the service no longer has it
const savedStatus = (job) => {
    if (job.status !== 'Completed') {
        return { status: 'failed', progress: 0, message: job.error || 'Job failed', title: job.title, clips: [] };
    }
    const details = readJobDetails(job.id);
    return {
        status: 'completed',
        progress: 100,
        message: 'Processing Complete!',
        title: job.title,
        clips: details.clips || [],
        transcript: details.transcript || '',
        warnings: job.warnings || [],
    };
};

const recordStatus = (job, data) => {
    if (data.status === 'completed' && job.status !== 'Completed') {
        const clips = Array.isArray(data.clips) ? data.clips : [];
        writeJobDetails(job.id, { clips, transcript: data.transcript || '' });
        Object.assign(job, {
            status: 'Completed',
            clips: clips.length,
            scores: clips.map(c => Number(c?.score)).filter(score => Number.isFinite(score) && score > 0),
            thumbnail: clips.find(c => c.thumbnail_url)?.thumbnail_url || null,
            sourceDuration: data.source_duration ?? null,
            warnings: data.warnings || [],
        });
        if (data.source_title) job.title = data.source_title;
        saveJobs();
    } else if (data.status === 'failed' && job.status !== 'Failed') {
        job.status = 'Failed';
        job.error = data.message || 'Job failed';
        saveJobs();
    }
};

// Calls the Python pipeline, turning connection failures into a clear 503
const callPipeline = async (endpoint, { body, timeoutMs = 30000 } = {}) => {
    try {
        return await fetch(`${PYTHON_API_URL}${endpoint}`, {
            method: body ? 'POST' : 'GET',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (error) {
        console.error(`AI service request to ${endpoint} failed:`, error.cause?.code || error.message);
        throw httpError(503, 'The AI service is unavailable. Make sure it is running and try again.');
    }
};

// Records the job and hands it to the Python pipeline. If the pipeline can't take it,
// the job is marked failed instead of staying 'Processing' forever.
const startPipelineJob = async (job, endpoint, payload) => {
    jobsHistory.unshift(job);
    saveJobs();

    try {
        const response = await callPipeline(endpoint, { body: { jobId: job.id, ...payload } });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw httpError(response.status >= 500 ? 502 : response.status, data.error || 'The AI service could not start this job.');
        }
    } catch (error) {
        job.status = 'Failed';
        job.error = error.message;
        saveJobs();
        throw error;
    }
};

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------

// Tells clients whether an access token is needed and whether the one they sent works
app.get('/api/session', (req, res) => {
    res.json({ tokenRequired: tokenRequired(), authenticated: isAuthorized(req) });
});

// OAuth flows run in a browser tab, which can't send the access token; they are checked with tickets instead
app.use('/auth', authRouter);

// Everything below requires the access token when API_TOKEN is set
app.use('/api', requireToken);

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
app.post('/api/jobs', upload.single('video'), async (req, res) => {
    const { videoUrl, layout } = req.body || {};
    const file = req.file;

    if (videoUrl && file) {
        throw httpError(400, 'Send either a video file or a URL, not both.');
    }
    if (!videoUrl && !file) {
        throw httpError(400, 'Please provide a video file or URL');
    }
    // Local file paths are only ever built by the server from an actual upload
    if (videoUrl && !isHttpUrl(videoUrl)) {
        throw httpError(400, 'Video URL must start with http:// or https://');
    }

    const job = {
        id: createId('job'),
        type: 'clips',
        title: file ? file.originalname : videoUrl,
        status: 'Processing',
        clips: 0,
        thumbnail: null,
        createdAt: Date.now()
    };

    await startPipelineJob(job, '/api/process', {
        videoUrl: file ? `file://${file.path}` : videoUrl,
        layout: pick(layout, ['vertical', 'horizontal'], 'vertical')
    });

    res.json({ message: 'Job received successfully', jobId: job.id, status: 'queued' });
});

app.get('/api/jobs', (req, res) => {
    res.json(jobsHistory.map(jobSummary));
});

app.post('/api/story-to-video', async (req, res) => {
    const { story, style, voice, aspectRatio } = req.body || {};

    if (typeof story !== 'string' || !story.trim()) {
        throw httpError(400, 'Please provide a story');
    }
    if (story.length > 20000) {
        throw httpError(400, 'Stories are limited to 20,000 characters.');
    }

    const job = {
        id: createId('story'),
        type: 'story_to_video',
        title: story.trim().split(/\s+/).slice(0, 8).join(' '),
        status: 'Processing',
        clips: 0,
        thumbnail: null,
        createdAt: Date.now()
    };

    await startPipelineJob(job, '/api/story-to-video', {
        story,
        style: text(style, 50) || 'Cinematic',
        voice: /^[a-z]{2,3}-[A-Z]{2}-\w+$/.test(voice) ? voice : 'en-US-ChristopherNeural',
        aspectRatio: pick(aspectRatio, ['9:16', '16:9', '1:1'], '9:16')
    });

    res.json({ message: 'Story job received successfully', jobId: job.id, status: 'queued' });
});

app.post('/api/auto-edit', upload.single('video'), async (req, res) => {
    const { videoUrl, layout, style, prompt } = req.body || {};
    const file = req.file;

    if (videoUrl && file) {
        throw httpError(400, 'Send either a video file or a URL, not both.');
    }
    if (!videoUrl && !file) {
        throw httpError(400, 'Please provide a video file or URL');
    }
    if (videoUrl && !isHttpUrl(videoUrl)) {
        throw httpError(400, 'Video URL must start with http:// or https://');
    }

    const job = {
        id: createId('auto'),
        type: 'auto_edit',
        title: file ? file.originalname : videoUrl,
        status: 'Processing',
        clips: 0,
        thumbnail: null,
        createdAt: Date.now()
    };

    await startPipelineJob(job, '/api/auto-edit', {
        videoUrl: file ? `file://${file.path}` : videoUrl,
        layout: pick(layout, ['9:16', '16:9', '1:1'], '9:16'),
        style: text(style, 50) || 'Cinematic',
        prompt: text(prompt, 2000)
    });

    res.json({ message: 'Auto edit job received successfully', jobId: job.id, status: 'queued' });
});

app.get('/api/jobs/:id', async (req, res) => {
    const job = jobsHistory.find(j => j.id === req.params.id);

    let response;
    try {
        response = await callPipeline(`/api/status/${encodeURIComponent(req.params.id)}`, { timeoutMs: 10000 });
    } catch (error) {
        // Finished jobs can still be shown while the AI service is down
        if (job && job.status !== 'Processing') return res.json(savedStatus(job));
        throw error;
    }

    if (response.status === 404) {
        // The AI service keeps jobs in memory, so after a restart only our saved copy is left
        if (job && job.status === 'Processing' && Date.now() - job.createdAt > JOB_LOST_AFTER_MS) {
            job.status = 'Failed';
            job.error = 'Processing was interrupted because the AI service restarted. Please submit the video again.';
            saveJobs();
        }
        if (job && job.status !== 'Processing') return res.json(savedStatus(job));
        throw httpError(404, 'Job not found');
    }
    if (!response.ok) {
        throw httpError(502, `AI service error: ${response.statusText}`);
    }

    const data = await response.json();
    if (job) recordStatus(job, data);
    res.json(data);
});

app.post('/api/export', async (req, res) => {
    const body = { ...req.body };
    if (typeof body.clipUrl === 'string') {
        body.clipUrl = publicMediaPath(body.clipUrl) || body.clipUrl;
    }
    const response = await callPipeline('/api/export', { body, timeoutMs: 10 * 60 * 1000 });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw httpError(response.status >= 500 ? 502 : response.status, data.error || 'Export failed');
    }
    res.json(data);
});

// Real numbers only: anything that isn't measured is returned as null
app.get('/api/analytics', async (req, res) => {
    const countBy = (items, key) => items.reduce((counts, item) => {
        counts[key(item)] = (counts[key(item)] || 0) + 1;
        return counts;
    }, {});

    const completed = jobsHistory.filter(j => j.status === 'Completed');
    const scores = completed.flatMap(j => (Array.isArray(j.scores) ? j.scores : []));
    const durations = completed.map(j => Number(j.sourceDuration)).filter(d => Number.isFinite(d) && d > 0);

    const posts = await db.allAsync(`SELECT status, platform_results FROM posts`);
    const platforms = {};
    for (const post of posts) {
        let results = {};
        try { results = JSON.parse(post.platform_results || '{}') || {}; } catch {}
        for (const [platform, result] of Object.entries(results)) {
            const counts = platforms[platform] || (platforms[platform] = { uploaded: 0, failed: 0 });
            if (result === 'uploaded') counts.uploaded++;
            else if (result && result.error) counts.failed++;
        }
    }
    const postStatuses = countBy(posts, p => p.status);

    res.json({
        jobs: {
            total: jobsHistory.length,
            completed: completed.length,
            failed: jobsHistory.filter(j => j.status === 'Failed').length,
            processing: jobsHistory.filter(j => j.status === 'Processing').length,
        },
        jobsByType: countBy(jobsHistory, j => j.type || 'clips'),
        totalClips: completed.reduce((sum, j) => sum + (Number(j.clips) || 0), 0),
        avgViralityScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        // Only jobs whose source length was measured count towards this
        hoursProcessed: durations.length ? Number((durations.reduce((a, b) => a + b, 0) / 3600).toFixed(1)) : null,
        posts: {
            total: posts.length,
            uploaded: postStatuses.uploaded || 0,
            failed: postStatuses.failed || 0,
            scheduled: (postStatuses.pending || 0) + (postStatuses.processing || 0),
        },
        platforms,
    });
});

// ---------------------------------------------------------------------------
// Social accounts
// ---------------------------------------------------------------------------
app.get('/api/accounts', async (req, res) => {
    // Never send tokens to the client
    res.json(await db.allAsync(`SELECT id, platform, account_name, status, created_at FROM accounts ORDER BY created_at DESC`));
});

app.delete('/api/accounts/:id', async (req, res) => {
    const { changes } = await db.runAsync(`DELETE FROM accounts WHERE id = ?`, [req.params.id]);
    if (!changes) throw httpError(404, 'Account not found');
    res.json({ success: true });
});

// Short-lived ticket that lets a browser tab start /auth/:platform when an access token is required
app.post('/api/oauth/ticket', (req, res) => {
    const { platform, returnTo } = req.body || {};
    res.json(createOAuthTicket(platform, returnTo));
});

// ---------------------------------------------------------------------------
// Publishing queue
// ---------------------------------------------------------------------------
app.get('/api/posts', async (req, res) => {
    res.json(await db.allAsync(`SELECT * FROM posts ORDER BY created_at DESC`));
});

app.post('/api/posts', async (req, res) => {
    const { clip_url, platforms, title, description, hashtags, scheduled_time } = req.body || {};
    const storedClipUrl = publicMediaPath(clip_url);

    // Only clips this server rendered can be published; the queue reads them straight from disk
    if (!storedClipUrl || !resolveMediaUrl(storedClipUrl)) {
        throw httpError(400, 'Choose a generated clip to publish. Export it first if you customized it.');
    }
    const targets = Array.isArray(platforms) ? [...new Set(platforms)] : [];
    if (targets.length === 0) {
        throw httpError(400, 'Select at least one platform.');
    }
    const unsupported = targets.filter(p => !SUPPORTED_PLATFORMS.includes(p));
    if (unsupported.length > 0) {
        throw httpError(400, `Publishing to ${unsupported.join(', ')} isn't supported.`);
    }

    // Stored as a UTC SQLite datetime string ('YYYY-MM-DD HH:MM:SS'); the queue compares in UTC.
    // If empty or "now", we schedule it 5 seconds from now
    const scheduledDate = (!scheduled_time || scheduled_time === 'now')
        ? new Date(Date.now() + 5000)
        : new Date(scheduled_time);
    if (Number.isNaN(scheduledDate.getTime())) {
        throw httpError(400, 'Invalid scheduled time');
    }
    const sqlTime = scheduledDate.toISOString().replace('T', ' ').substring(0, 19);

    const id = createId('post');
    await db.runAsync(`INSERT INTO posts (id, clip_url, platforms, title, description, hashtags, scheduled_time) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, storedClipUrl, JSON.stringify(targets), text(title, 200), text(description, 5000), text(hashtags, 1000), sqlTime]);
    res.json({ success: true, id, scheduled_time: sqlTime });
});

// Queues a failed post again. Platforms that already succeeded are skipped; uploads whose outcome
// was unclear (e.g. the server stopped mid-upload) are attempted again because the user asked for it.
app.post('/api/posts/:id/retry', async (req, res) => {
    const post = await db.getAsync(`SELECT * FROM posts WHERE id = ?`, [req.params.id]);
    if (!post) throw httpError(404, 'Post not found');
    if (post.status !== 'failed') throw httpError(400, 'Only failed posts can be retried.');

    let platforms = [];
    let results = {};
    try { platforms = JSON.parse(post.platforms); } catch {}
    try { results = JSON.parse(post.platform_results || '{}') || {}; } catch {}
    for (const platform of Array.isArray(platforms) ? platforms : []) {
        if (results[platform] !== 'uploaded') results[platform] = { retryRequested: true };
    }

    await db.runAsync(`UPDATE posts SET status = 'pending', retry_count = 0, scheduled_time = datetime('now'), error_message = NULL, platform_results = ? WHERE id = ?`,
        [JSON.stringify(results), post.id]);
    res.json({ success: true });
});

app.delete('/api/posts/:id', async (req, res) => {
    const { changes } = await db.runAsync(`DELETE FROM posts WHERE id = ? AND status IN ('pending', 'failed')`, [req.params.id]);
    if (!changes) throw httpError(400, 'Only scheduled or failed posts can be removed.');
    res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, _next) => {
    discardUpload(req);

    if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE' ? `Videos are limited to ${MAX_UPLOAD_MB} MB.` : err.message;
        return res.status(400).json({ error: message });
    }

    // Errors with a status were raised deliberately (or by body parsing) and are safe to show
    const expected = Boolean(err.status || err.statusCode);
    const status = err.status || err.statusCode || 500;
    if (!expected) console.error(`Error handling ${req.method} ${req.path}:`, err);
    else if (status >= 500) console.error(`${req.method} ${req.path}: ${err.message}`);
    res.status(status).json({ error: expected ? err.message : 'Internal server error' });
});

(async () => {
    try {
        await db.ready;
    } catch (err) {
        console.error('[DB] Initialization failed:', err);
        process.exit(1);
    }

    startQueueWorker().catch((err) => console.error('[Queue] Worker failed to start:', err));

    app.listen(port, () => {
        console.log(`Backend server running on http://localhost:${port}`);
        console.log(`Proxying AI requests to ${PYTHON_API_URL}`);
        if (tokenRequired()) console.log('API access token required (API_TOKEN is set).');
    });
})();
