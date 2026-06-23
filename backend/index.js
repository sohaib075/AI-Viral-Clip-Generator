const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Set up temporary storage for uploaded files
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

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
app.post('/api/jobs', upload.single('video'), (req, res) => {
    // Basic route to receive video upload or URL
    const videoUrl = req.body.videoUrl;
    const file = req.file;

    if (!videoUrl && !file) {
        return res.status(400).json({ error: 'Please provide a video file or URL' });
    }

    // Generate a job ID
    const jobId = `job_${Date.now()}`;

    // Here we will eventually trigger the Python pipeline
    
    res.json({
        message: 'Job received successfully',
        jobId: jobId,
        status: 'queued'
    });
});

app.get('/api/jobs/:id', (req, res) => {
    // Polling endpoint for frontend
    res.json({
        jobId: req.params.id,
        status: 'processing',
        progress: 10
    });
});

app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
});
