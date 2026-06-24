const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

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
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

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

        // Trigger the Python pipeline
        const response = await fetch(`${PYTHON_API_URL}/api/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jobId: jobId,
                videoUrl: targetUrl
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

app.get('/api/jobs/:id', async (req, res) => {
    try {
        const jobId = req.params.id;
        const response = await fetch(`${PYTHON_API_URL}/api/status/${jobId}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                return res.status(404).json({ error: 'Job not found' });
            }
            throw new Error(`Python API error: ${response.statusText}`);
        }
        
        const data = await response.json();
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

app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
    console.log(`Proxying AI requests to ${PYTHON_API_URL}`);
});
