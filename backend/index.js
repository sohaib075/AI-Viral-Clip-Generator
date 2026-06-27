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
app.use(cors());
app.use(express.json());

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
    db.all(`SELECT * FROM accounts`, [], (err, rows) => {
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
    if (!clip_url || !platforms || platforms.length === 0) {
        return res.status(400).json({ error: 'Missing clip URL or platforms' });
    }

    // scheduled_time should be a valid SQLite datetime string, e.g., 'YYYY-MM-DD HH:MM:SS'
    // If empty or "now", we schedule it 5 seconds from now for demo
    let sqlTime = scheduled_time;
    if (!sqlTime || sqlTime === 'now') {
        sqlTime = new Date(Date.now() + 5000).toISOString().replace('T', ' ').substring(0, 19);
    } else {
        sqlTime = new Date(sqlTime).toISOString().replace('T', ' ').substring(0, 19);
    }

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
startQueueWorker();

app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
    console.log(`Proxying AI requests to ${PYTHON_API_URL}`);
});
