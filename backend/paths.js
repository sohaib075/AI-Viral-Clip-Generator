const fs = require('fs');
const path = require('path');

// Shared with the Python pipeline (mounted at /temp in Docker)
const TEMP_DIR = path.resolve(__dirname, '..', 'temp');
// Job history and the scheduler database (git-ignored, mounted as a Docker volume)
const DATA_DIR = path.join(__dirname, 'data');
// Rendered output that clients may load directly. Input uploads, transcripts and logs stay private.
const PUBLIC_MEDIA_DIRS = ['Clips', 'StoryVideos'];

// Maps a media URL such as http://host:5000/temp/Clips/x.mp4 (or /temp/Clips/x.mp4) to its file on disk.
// Returns null unless it names an existing file directly inside a public media folder.
function resolveMediaUrl(value) {
    if (typeof value !== 'string' || !value) return null;
    let parts;
    try {
        parts = decodeURIComponent(new URL(value, 'http://localhost').pathname).split('/').filter(Boolean);
    } catch {
        return null;
    }
    if (parts.length !== 3 || parts[0] !== 'temp' || !PUBLIC_MEDIA_DIRS.includes(parts[1])) return null;

    const fileName = parts[2];
    const filePath = path.join(TEMP_DIR, parts[1], fileName);
    // Rejects '..' and names containing path separators
    if (fileName.startsWith('.') || path.basename(filePath) !== fileName) return null;

    try {
        return fs.statSync(filePath).isFile() ? filePath : null;
    } catch {
        return null;
    }
}

// Drop ?access_token= so tokens are never persisted in the publishing queue
function publicMediaPath(value) {
    if (typeof value !== 'string' || !value) return null;
    try {
        const url = new URL(value, 'http://localhost');
        if (!url.pathname.startsWith('/temp/')) return null;
        return url.pathname;
    } catch {
        return null;
    }
}

module.exports = { TEMP_DIR, DATA_DIR, PUBLIC_MEDIA_DIRS, resolveMediaUrl, publicMediaPath };
