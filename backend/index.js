const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./db');
const { startQueueWorker } = require('./queue');

const app = express();
const port = process.env.PORT || 5000;
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://127.0.0.1:5001';

// Middleware
// Browsers may only call this API from the web UI. Localhost origins are always allowed;
// add others (e.g. a deployed frontend) with ALLOWED_ORIGINS or FRONTEND_URL. Requests without
// an Origin header (the mobile app, OAuth redirects, curl) are not affected.
const toOrigin = (value) => {
    try {
        return new URL(value.trim()).origin;
    } catch {
        return null;
    }
};
const allowedOrigins = new Set(
    [...(process.env.ALLOWED_ORIGINS || '').split(','), process.env.FRONTEND_URL || '']
        .map(toOrigin)
        .filter(Boolean)
);
const isAllowedOrigin = (origin) => {
    if (allowedOrigins.has(origin)) return true;
    try {
        const { hostname } = new URL(origin);
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    } catch {
        return false;
    }
};

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
        return res.status(403).json({ error: 'Origin not allowed' });
    }
    next();
});
app.use(cors({ origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)) }));
app.use(express.json());

const isHttpUrl = (value) => {
    try {
        const { protocol } = new URL(value);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
};

// Set up temporary storage for uploaded files and serve them statically
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}
// Serve the temp directory at /temp
app.use('/temp', express.static(tempDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const inputDir = path.join(tempDir, 'Input');
        if (!fs.existsSync(inputDir)) {
            fs.mkdirSync(inputDir, { recursive: true });
        }
        cb(null, inputDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

const JOBS_FILE = path.join(__dirname, 'jobs.json');

// In-memory data store for demonstration, now backed by a file
let jobsHistory = [];
if (fs.existsSync(JOBS_FILE)) {
    try {
        jobsHistory = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
    } catch (e) {
        console.error('Failed to load jobs from file', e);
    }
}

const saveJobs = () => {
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobsHistory, null, 2));
};

// API Routes
app.post('/api/jobs', upload.single('video'), async (req, res) => {
    try {
        const videoUrl = req.body.videoUrl;
        const file = req.file;

        if (!videoUrl && !file) {
            return res.status(400).json({ error: 'Please provide a video file or URL' });
        }
        // Local file paths are only ever built by the server from an actual upload
        if (videoUrl && !isHttpUrl(videoUrl)) {
            return res.status(400).json({ error: 'Video URL must start with http:// or https://' });
        }

        // Generate a job ID
        const jobId = `job_${Date.now()}`;
        
        // If it's a file upload, we would need to pass the file path to python,
        // but for now let's focus on videoUrl processing
        const targetUrl = videoUrl || (file ? `file://${file.path}` : null);

        // Track job in history
        const newJob = {
            id: jobId,
            title: targetUrl ? targetUrl.substring(0, 30) + '...' : 'Uploaded Video',
            status: 'Processing',
            time: 'Just now',
            clips: 0,
            duration: '0:00:00',
            thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&auto=format&fit=crop&q=80',
            createdAt: Date.now()
        };
        jobsHistory.unshift(newJob);
        saveJobs();

        const layout = req.body.layout || 'vertical';

        // Trigger the Python pipeline
        const response = await fetch(`${PYTHON_API_URL}/api/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jobId: jobId,
                videoUrl: targetUrl,
                layout: layout
            })
        });

        if (!response.ok) {
            throw new Error(`Python API error: ${response.statusText}`);
        }

        res.json({
            message: 'Job received successfully',
            jobId: jobId,
            status: 'queued'
        });
    } catch (error) {
        console.error("Error creating job:", error);
        res.status(500).json({ error: 'Failed to start job' });
    }
});

// Get all jobs
app.get('/api/jobs', (req, res) => {
    res.json(jobsHistory);
});

app.post('/api/story-to-video', async (req, res) => {
    try {
        const { story, style, voice, aspectRatio } = req.body;

        if (!story) {
            return res.status(400).json({ error: 'Please provide a story' });
        }

        const jobId = `story_${Date.now()}`;

        // Track job in history
        const newJob = {
            id: jobId,
            title: 'AI Story Video',
            status: 'Processing',
            time: 'Just now',
            clips: 0,
            duration: '0:00:00',
            thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80',
            createdAt: Date.now(),
            type: 'story_to_video'
        };
        jobsHistory.unshift(newJob);
        saveJobs();

        // Trigger the Python pipeline
        const response = await fetch(`${PYTHON_API_URL}/api/story-to-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId: jobId,
                story: story,
                style: style,
                voice: voice,
                aspectRatio: aspectRatio
            })
        });

        if (!response.ok) {
            throw new Error(`Python API error: ${response.statusText}`);
        }

        res.json({
            message: 'Story job received successfully',
            jobId: jobId,
            status: 'queued'
        });
    } catch (error) {
        console.error("Error creating story job:", error);
        res.status(500).json({ error: 'Failed to start story job' });
    }
});

app.post('/api/auto-edit', upload.single('video'), async (req, res) => {
    try {
        const { videoUrl, layout, style, prompt } = req.body;
        const file = req.file;

        if (!videoUrl && !file) {
            return res.status(400).json({ error: 'Please provide a video file or URL' });
        }
        if (videoUrl && !isHttpUrl(videoUrl)) {
            return res.status(400).json({ error: 'Video URL must start with http:// or https://' });
        }

        const jobId = `auto_${Date.now()}`;
        const targetUrl = videoUrl || (file ? `file://${file.path}` : null);

        // Track job in history
        const newJob = {
            id: jobId,
            title: 'AI Auto Edit',
            status: 'Processing',
            time: 'Just now',
            clips: 0,
            duration: '0:00:00',
            thumbnail: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&auto=format&fit=crop&q=80',
            createdAt: Date.now(),
            type: 'auto_edit'
        };
        jobsHistory.unshift(newJob);
        saveJobs();

        // Trigger the Python pipeline
        const response = await fetch(`${PYTHON_API_URL}/api/auto-edit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId: jobId,
                videoUrl: targetUrl,
                layout: layout || '9:16',
                style: style || 'Cinematic',
                prompt: prompt || ''
            })
        });

        if (!response.ok) {
            throw new Error(`Python API error: ${response.statusText}`);
        }

        res.json({
            message: 'Auto edit job received successfully',
            jobId: jobId,
            status: 'queued'
        });
    } catch (error) {
        console.error("Error creating auto edit job:", error);
        res.status(500).json({ error: 'Failed to start auto edit job' });
    }
});

// Analytics mock endpoint
app.get('/api/analytics', (req, res) => {
    const totalClips = jobsHistory.reduce((acc, job) => acc + (job.clips || 0), 0);
    const totalHours = jobsHistory.length > 0 ? (jobsHistory.length * 1.5).toFixed(1) : 0;
    const avgVirality = jobsHistory.length > 0 ? 85 : 0;

    res.json({
        totalClips,
        hoursProcessed: totalHours,
        avgVirality: `${avgVirality}%`,
        views: '0',
        engagementRate: '0%',
        timeSaved: '0h'
    });
});

// User settings mock endpoint
app.get('/api/user/settings', (req, res) => {
    res.json({
        firstName: 'ClipGenius',
        lastName: 'User',
        email: 'user@example.com',
        company: 'AI Viral Clips'
    });
});

app.get('/api/jobs/:id', async (req, res) => {
    try {
        const jobId = req.params.id;
        
        // Also get the clips if they are stored in the job
        const jobIndex = jobsHistory.findIndex(j => j.id === jobId);
        
        const response = await fetch(`${PYTHON_API_URL}/api/status/${jobId}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                // Return local job history if python forgot it but we saved it
                if (jobIndex !== -1 && jobsHistory[jobIndex].status === 'Completed') {
                    const localJob = { ...jobsHistory[jobIndex] };
                    if (localJob.clipsData) {
                        localJob.clips = localJob.clipsData; // Map it back to the expected 'clips' array format
                    }
                    return res.json(localJob);
                }
                return res.status(404).json({ error: 'Job not found' });
            }
            throw new Error(`Python API error: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Update history status if changed
        if (jobIndex !== -1) {
            let changed = false;
            if (data.status === 'completed' && jobsHistory[jobIndex].status !== 'Completed') {
                jobsHistory[jobIndex].status = 'Completed';
                jobsHistory[jobIndex].clips = data.clips ? data.clips.length : 0;
                jobsHistory[jobIndex].clipsData = data.clips; // Save clips in history
                if (data.clips && data.clips.length > 0 && data.clips[0].thumbnail_url) {
                    jobsHistory[jobIndex].thumbnail = data.clips[0].thumbnail_url;
                }
                if (data.transcript) {
                    jobsHistory[jobIndex].transcript = data.transcript;
                }
                changed = true;
            } else if (data.status === 'failed' && jobsHistory[jobIndex].status !== 'Failed') {
                jobsHistory[jobIndex].status = 'Failed';
                changed = true;
            }
            if (changed) {
                saveJobs();
            }
        }

        res.json(data);
    } catch (error) {
        if (error.cause && error.cause.code === 'ECONNREFUSED') {
            console.error(`Error: Python backend is unreachable (ECONNREFUSED). Is it running?`);
            res.status(503).json({ error: 'Python backend is unavailable' });
        } else {
            console.error(`Error fetching job status for ${req.params.id}:`, error.message);
            res.status(500).json({ error: 'Failed to fetch job status' });
        }
    }
});

app.post('/api/export', async (req, res) => {
    try {
        const response = await fetch(`${PYTHON_API_URL}/api/export`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });
        
        if (!response.ok) {
            const errData = await response.text();
            throw new Error(`Python API error: ${response.statusText} - ${errData}`);
        }
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error proxying export job:", error);
        res.status(500).json({ error: 'Failed to start export job' });
    }
});

app.get('/api/accounts', (req, res) => {
    // Never send tokens to the client
    db.all(`SELECT id, platform, account_name, status, created_at FROM accounts`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.post('/api/accounts', (req, res) => {
    // Deprecated for mock connect. Use OAuth instead.
    return res.status(400).json({ error: 'Use /auth/:platform for real connections' });
});

app.delete('/api/accounts/:id', (req, res) => {
    db.run(`DELETE FROM accounts WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to disconnect account' });
        res.json({ success: true });
    });
});

app.get('/api/posts', (req, res) => {
    db.all(`SELECT * FROM posts ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.post('/api/posts', (req, res) => {
    const { clip_url, platforms, title, description, hashtags, scheduled_time } = req.body;
    const id = `post_${Date.now()}`;
    
    // Validate inputs
    if (!clip_url || !Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({ error: 'Missing clip URL or platforms' });
    }

    // Stored as a UTC SQLite datetime string ('YYYY-MM-DD HH:MM:SS'); the queue compares in UTC.
    // If empty or "now", we schedule it 5 seconds from now
    const scheduledDate = (!scheduled_time || scheduled_time === 'now')
        ? new Date(Date.now() + 5000)
        : new Date(scheduled_time);
    if (Number.isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduled time' });
    }
    const sqlTime = scheduledDate.toISOString().replace('T', ' ').substring(0, 19);

    db.run(`INSERT INTO posts (id, clip_url, platforms, title, description, hashtags, scheduled_time) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, clip_url, JSON.stringify(platforms), title, description, hashtags, sqlTime], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Failed to schedule post' });
            }
            res.json({ success: true, id, scheduled_time: sqlTime });
    });
});

// Auth Routes
app.use('/auth', require('./auth'));

// Start background worker
startQueueWorker().catch((err) => console.error('[Queue] Worker failed to start:', err));

app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
    console.log(`Proxying AI requests to ${PYTHON_API_URL}`);
});
