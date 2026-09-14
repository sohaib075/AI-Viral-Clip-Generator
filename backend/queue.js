const db = require('./db');
const { decrypt } = require('./crypto');
const { validateVideo } = require('./uploaders/validator');
const { refreshAccessToken } = require('./uploaders/tokens');
const { uploadToYouTube } = require('./uploaders/youtube');
const { uploadToTwitter } = require('./uploaders/twitter');
const { uploadToTikTok } = require('./uploaders/tiktok');
const { uploadToInstagram } = require('./uploaders/instagram');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');

const UPLOADERS = {
    youtube: uploadToYouTube,
    x: uploadToTwitter,
    tiktok: uploadToTikTok,
    instagram: uploadToInstagram,
};

const MAX_RETRIES = 3;
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

// An error that won't go away by retrying (validation failure, duplicate, revoked credentials)
const permanentError = (message) => Object.assign(new Error(message), { retryable: false });

const downloadAndHashVideo = async (url) => {
    const tempDir = path.join(__dirname, 'temp');
    fs.mkdirSync(tempDir, { recursive: true });
    const tempVideoPath = path.join(tempDir, `queue_${Date.now()}_${Math.floor(Math.random()*1000)}.mp4`);

    console.log(`[Queue] Downloading video to compute global hash...`);
    const hash = crypto.createHash('sha256');
    try {
        // The abort signal also covers the body download, which axios' timeout does not
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: DOWNLOAD_TIMEOUT_MS,
            signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
        });
        const hasher = new Transform({
            transform(chunk, encoding, callback) {
                hash.update(chunk);
                callback(null, chunk);
            }
        });
        await pipeline(response.data, hasher, fs.createWriteStream(tempVideoPath));
    } catch (err) {
        fs.rmSync(tempVideoPath, { force: true });
        throw err;
    }

    return { tempVideoPath, videoHash: hash.digest('hex') };
};

const uploadToPlatform = async (post, platform, tempVideoPath, videoHash) => {
    const upload = UPLOADERS[platform];
    if (!upload) {
        throw permanentError('Platform SDK not implemented yet.');
    }

    // Newest connection wins, so reconnecting an account replaces stale tokens
    const account = await db.getAsync(
        `SELECT * FROM accounts WHERE platform = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`, [platform]);
    if (!account || !account.access_token || account.access_token === 'mock_token') {
        throw new Error('No valid API credentials connected.');
    }

    // Decrypt Tokens
    const accessToken = decrypt(account.access_token);
    if (!accessToken) {
        throw permanentError('Stored credentials could not be decrypted. Check ENCRYPTION_KEY and reconnect the account.');
    }
    const credentials = { ...account, access_token: accessToken, refresh_token: decrypt(account.refresh_token) };

    // 1. Validate video (the result won't change on retry)
    try {
        await validateVideo(tempVideoPath, platform);
    } catch (err) {
        throw permanentError(err.message);
    }

    // 2. Refresh short-lived tokens
    await refreshAccessToken(credentials);

    // 3. Strict Duplicate Check (Global Lock per platform)
    try {
        await db.runAsync(`INSERT INTO uploaded_videos (video_hash, platform, upload_status) VALUES (?, ?, 'uploading')`, [videoHash, platform]);
    } catch (err) {
        if (err.code !== 'SQLITE_CONSTRAINT') throw err;
        const existing = await db.getAsync(`SELECT upload_status FROM uploaded_videos WHERE video_hash = ? AND platform = ?`, [videoHash, platform]);
        if (existing?.upload_status === 'uploading') {
            throw permanentError('An earlier upload of this video was interrupted or is still running. Check the platform before posting again.');
        }
        throw permanentError('Blocked: Video already uploaded to this platform.');
    }

    // 4. Upload using local file
    try {
        await upload(post, credentials, tempVideoPath);
    } catch (err) {
        // Release the lock on failure so the file can be retried
        await db.runAsync(`DELETE FROM uploaded_videos WHERE video_hash = ? AND platform = ?`, [videoHash, platform]);
        throw err;
    }

    // Mark as successfully uploaded in the global registry
    await db.runAsync(`UPDATE uploaded_videos SET upload_status = 'completed' WHERE video_hash = ? AND platform = ?`, [videoHash, platform]);
};

const saveOutcome = async (post, platforms, results) => {
    const uploaded = platforms.filter(p => results[p] === 'uploaded');
    const failed = platforms.filter(p => results[p] !== 'uploaded');
    const resultsJson = JSON.stringify(results);

    if (platforms.length > 0 && failed.length === 0) {
        await db.runAsync(`UPDATE posts SET status = 'uploaded', error_message = NULL, platform_results = ? WHERE id = ?`, [resultsJson, post.id]);
        console.log(`[Queue] Successfully uploaded post ${post.id} to all platforms.`);
        return;
    }

    const errorParts = failed.map(p => `[${p}] ${results[p]?.error || 'Not attempted'}`);
    if (platforms.length === 0) errorParts.push('No platforms selected.');
    if (uploaded.length > 0) errorParts.unshift(`Uploaded to: ${uploaded.join(', ')}`);
    const errorStr = errorParts.join(' | ').substring(0, 500);

    const nextRetry = post.retry_count + 1;
    const canRetry = nextRetry <= MAX_RETRIES && failed.some(p => results[p]?.retryable);

    if (canRetry) {
        // Only the platforms that haven't succeeded are attempted again
        await db.runAsync(`UPDATE posts SET status = 'pending', retry_count = ?, scheduled_time = datetime('now', '+15 minutes'), error_message = ?, platform_results = ? WHERE id = ?`,
            [nextRetry, errorStr, resultsJson, post.id]);
        console.log(`[Queue] Post ${post.id} failed. Retrying... (${nextRetry}/${MAX_RETRIES})`);
    } else {
        await db.runAsync(`UPDATE posts SET status = 'failed', error_message = ?, platform_results = ? WHERE id = ?`, [errorStr, resultsJson, post.id]);
        console.log(`[Queue] Post ${post.id} completed with permanent failures.`);
    }
};

const processPost = async (post) => {
    console.log(`[Queue] Processing post ${post.id} for platforms: ${post.platforms}`);

    let platforms = [];
    try { platforms = JSON.parse(post.platforms); } catch (e) {}
    if (!Array.isArray(platforms)) platforms = [];

    let results = {};
    try { results = JSON.parse(post.platform_results || '{}') || {}; } catch (e) {}

    let tempVideoPath = null;
    try {
        const download = await downloadAndHashVideo(post.clip_url);
        tempVideoPath = download.tempVideoPath;
        console.log(`[Queue] Video hash generated: ${download.videoHash}`);

        for (const platform of platforms) {
            if (results[platform] === 'uploaded') continue; // Done on an earlier attempt
            try {
                await uploadToPlatform(post, platform, tempVideoPath, download.videoHash);
                results[platform] = 'uploaded';
            } catch (err) {
                console.error(`[Queue] [${platform}] Upload failed for post ${post.id}:`, err.message);
                results[platform] = { error: err.message || 'Unknown error', retryable: err.retryable !== false };
            }
            // Save progress per platform in case the server stops mid-post
            await db.runAsync(`UPDATE posts SET platform_results = ? WHERE id = ?`, [JSON.stringify(results), post.id]);
        }
    } catch (err) {
        console.error(`[Queue] Failed to download video for post ${post.id}:`, err.message);
        for (const platform of platforms) {
            if (results[platform] !== 'uploaded') {
                results[platform] = { error: `Failed to download video: ${err.message}`, retryable: true };
            }
        }
    } finally {
        // Cleanup local temp file
        if (tempVideoPath) fs.rmSync(tempVideoPath, { force: true });
    }

    await saveOutcome(post, platforms, results);
};

const processQueue = async () => {
    console.log("[Queue] Checking for scheduled posts...");

    try {
        // scheduled_time is stored in UTC, so compare against UTC
        const rows = await db.allAsync(`SELECT * FROM posts WHERE status = 'pending' AND scheduled_time <= datetime('now')`);
        if (rows.length === 0) return;

        console.log(`[Queue] Found ${rows.length} pending posts to upload.`);

        // Lock these posts by marking them 'processing' so the next 15-second tick ignores them
        const ids = rows.map(r => r.id);
        const placeholders = ids.map(() => '?').join(',');
        await db.runAsync(`UPDATE posts SET status = 'processing' WHERE id IN (${placeholders})`, ids);

        await Promise.all(rows.map(post => processPost(post).catch(async (err) => {
            console.error(`[Queue] Unexpected error processing post ${post.id}:`, err);
            await db.runAsync(`UPDATE posts SET status = 'failed', error_message = ? WHERE id = ?`,
                [String(err.message || err).substring(0, 500), post.id]).catch(() => {});
        })));
    } catch (err) {
        console.error('[Queue] Failed to process scheduled posts:', err);
    }
};

const startQueueWorker = async () => {
    await db.ready;
    try {
        // Posts left 'processing' were interrupted by a restart; queue them again.
        // Their platform_results keep already-finished platforms from being uploaded twice.
        const { changes } = await db.runAsync(`UPDATE posts SET status = 'pending' WHERE status = 'processing'`);
        if (changes > 0) console.log(`[Queue] Re-queued ${changes} interrupted post(s).`);
    } catch (err) {
        console.error('[Queue] Failed to re-queue interrupted posts:', err);
    }

    setInterval(processQueue, 15000);
    console.log("[Queue] Worker started. Checking every 15 seconds.");
};

module.exports = { startQueueWorker };
