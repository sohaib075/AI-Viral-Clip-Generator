const db = require('./db');
const { decrypt } = require('./crypto');
const { resolveMediaUrl } = require('./paths');
const { validateVideo } = require('./uploaders/validator');
const { refreshAccessToken } = require('./uploaders/tokens');
const { uploadToYouTube } = require('./uploaders/youtube');
const { uploadToTwitter } = require('./uploaders/twitter');
const { uploadToTikTok } = require('./uploaders/tiktok');
const { uploadToInstagram } = require('./uploaders/instagram');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADERS = {
    youtube: uploadToYouTube,
    x: uploadToTwitter,
    tiktok: uploadToTikTok,
    instagram: uploadToInstagram,
};
const SUPPORTED_PLATFORMS = Object.keys(UPLOADERS);

const MAX_RETRIES = 3;

// An error that won't go away by retrying (validation failure, duplicate, revoked credentials)
const permanentError = (message) => Object.assign(new Error(message), { retryable: false });

const hashFile = (filePath) => new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
        .on('data', chunk => hash.update(chunk))
        .on('error', reject)
        .on('end', () => resolve(hash.digest('hex')));
});

// Global duplicate lock: one upload per video per platform.
// 'uploading' = in progress, 'completed' = published, 'unconfirmed' = may have been published.
const acquireUploadLock = async (videoHash, platform, retryRequested) => {
    try {
        await db.runAsync(`INSERT INTO uploaded_videos (video_hash, platform, upload_status) VALUES (?, ?, 'uploading')`, [videoHash, platform]);
        return;
    } catch (err) {
        if (err.code !== 'SQLITE_CONSTRAINT') throw err;
    }

    const existing = await db.getAsync(`SELECT upload_status FROM uploaded_videos WHERE video_hash = ? AND platform = ?`, [videoHash, platform]);
    if (existing?.upload_status === 'completed') {
        throw permanentError('Blocked: Video already uploaded to this platform.');
    }
    if (!retryRequested) {
        throw permanentError('An earlier upload of this video may have been published. Check the platform, then use Retry to upload it again.');
    }
    // The user checked and asked to try again
    await db.runAsync(`UPDATE uploaded_videos SET upload_status = 'uploading' WHERE video_hash = ? AND platform = ?`, [videoHash, platform]);
};

const uploadToPlatform = async (post, platform, videoPath, videoHash, retryRequested) => {
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
        await validateVideo(videoPath, platform);
    } catch (err) {
        throw permanentError(err.message);
    }

    // 2. Refresh short-lived tokens
    await refreshAccessToken(credentials);

    // 3. Strict Duplicate Check
    await acquireUploadLock(videoHash, platform, retryRequested);

    // 4. Upload the local file
    try {
        await upload(post, credentials, videoPath);
    } catch (err) {
        if (err.mayHavePublished) {
            // Keep the lock so an automatic retry can't post the video twice
            await db.runAsync(`UPDATE uploaded_videos SET upload_status = 'unconfirmed' WHERE video_hash = ? AND platform = ?`, [videoHash, platform]);
            throw permanentError(`${err.message} It may still have been published, so check the platform before using Retry.`);
        }
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
    const errorStr = errorParts.join(' | ').substring(0, 1000);

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
    try { platforms = JSON.parse(post.platforms); } catch {}
    if (!Array.isArray(platforms)) platforms = [];

    let results = {};
    try { results = JSON.parse(post.platform_results || '{}') || {}; } catch {}

    // Clips are read straight from the temp folder; nothing is fetched over the network
    const videoPath = resolveMediaUrl(post.clip_url);
    if (!videoPath) {
        for (const platform of platforms) {
            if (results[platform] !== 'uploaded') {
                results[platform] = { error: 'The clip file no longer exists.', retryable: false };
            }
        }
        return saveOutcome(post, platforms, results);
    }

    let videoHash;
    try {
        videoHash = await hashFile(videoPath);
        console.log(`[Queue] Video hash generated: ${videoHash}`);
    } catch (err) {
        console.error(`[Queue] Failed to read clip for post ${post.id}:`, err.message);
        for (const platform of platforms) {
            if (results[platform] !== 'uploaded') {
                results[platform] = { error: `Failed to read the clip: ${err.message}`, retryable: true };
            }
        }
        return saveOutcome(post, platforms, results);
    }

    for (const platform of platforms) {
        if (results[platform] === 'uploaded') continue; // Done on an earlier attempt
        const retryRequested = results[platform]?.retryRequested === true;
        try {
            await uploadToPlatform(post, platform, videoPath, videoHash, retryRequested);
            results[platform] = 'uploaded';
        } catch (err) {
            console.error(`[Queue] [${platform}] Upload failed for post ${post.id}:`, err.message);
            results[platform] = { error: err.message || 'Unknown error', retryable: err.retryable !== false };
        }
        // Save progress per platform in case the server stops mid-post
        await db.runAsync(`UPDATE posts SET platform_results = ? WHERE id = ?`, [JSON.stringify(results), post.id]);
    }

    await saveOutcome(post, platforms, results);
};

const processQueue = async () => {
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
                [String(err.message || err).substring(0, 1000), post.id]).catch(() => {});
        })));
    } catch (err) {
        console.error('[Queue] Failed to process scheduled posts:', err);
    }
};

const startQueueWorker = async () => {
    await db.ready;
    try {
        // Uploads that were in flight when the server stopped may or may not have been published
        await db.runAsync(`UPDATE uploaded_videos SET upload_status = 'unconfirmed' WHERE upload_status = 'uploading'`);
        // Posts left 'processing' were interrupted by a restart; queue them again.
        // Their platform_results keep already-finished platforms from being uploaded twice.
        const { changes } = await db.runAsync(`UPDATE posts SET status = 'pending' WHERE status = 'processing'`);
        if (changes > 0) console.log(`[Queue] Re-queued ${changes} interrupted post(s).`);
    } catch (err) {
        console.error('[Queue] Failed to recover interrupted posts:', err);
    }

    setInterval(processQueue, 15000);
    console.log("[Queue] Worker started. Checking every 15 seconds.");
};

module.exports = { startQueueWorker, SUPPORTED_PLATFORMS };
