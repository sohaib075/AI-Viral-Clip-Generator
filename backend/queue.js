const db = require('./db');
const { decrypt } = require('./crypto');
const { validateVideo } = require('./uploaders/validator');
const { uploadToYouTube } = require('./uploaders/youtube');
const { uploadToTwitter } = require('./uploaders/twitter');
const { uploadToTikTok } = require('./uploaders/tiktok');
const { uploadToInstagram } = require('./uploaders/instagram');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

const downloadAndHashVideo = async (url) => {
    return new Promise(async (resolve, reject) => {
        try {
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const tempVideoPath = path.join(tempDir, `queue_${Date.now()}_${Math.floor(Math.random()*1000)}.mp4`);
            const writer = fs.createWriteStream(tempVideoPath);
            
            console.log(`[Queue] Downloading video to compute global hash...`);
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream'
            });

            const hash = crypto.createHash('sha256');

            response.data.on('data', (chunk) => {
                hash.update(chunk);
            });

            response.data.pipe(writer);

            writer.on('finish', () => {
                resolve({ tempVideoPath, videoHash: hash.digest('hex') });
            });

            writer.on('error', reject);
        } catch (e) {
            reject(e);
        }
    });
};

const processQueue = async () => {
    console.log("[Queue] Checking for scheduled posts...");
    
    db.all(`SELECT * FROM posts WHERE status = 'pending' AND scheduled_time <= datetime('now', 'localtime')`, [], (err, rows) => {
        if (err || rows.length === 0) return;

        console.log(`[Queue] Found ${rows.length} pending posts to upload.`);
        
        // Instantly lock these posts by marking them 'processing' so the next 15-second tick ignores them
        const ids = rows.map(r => r.id);
        const placeholders = ids.map(() => '?').join(',');
        db.run(`UPDATE posts SET status = 'processing' WHERE id IN (${placeholders})`, ids);

        rows.forEach(async (post) => {
            console.log(`[Queue] Processing post ${post.id} for platforms: ${post.platforms}`);
            
            let platforms = [];
            try { platforms = JSON.parse(post.platforms); } catch (e) {}

            let tempVideoPath = null;
            let videoHash = null;

            try {
                const result = await downloadAndHashVideo(post.clip_url);
                tempVideoPath = result.tempVideoPath;
                videoHash = result.videoHash;
                console.log(`[Queue] Video hash generated: ${videoHash}`);
            } catch (err) {
                console.error(`[Queue] Failed to download video for post ${post.id}:`, err.message);
                db.run(`UPDATE posts SET status = 'failed', error_message = 'Failed to download video.' WHERE id = ?`, [post.id]);
                return;
            }

            let successCount = 0;
            let errors = [];

            for (const platform of platforms) {
                const account = await new Promise((resolve) => {
                    db.get(`SELECT * FROM accounts WHERE platform = ? LIMIT 1`, [platform], (err, row) => resolve(row));
                });

                if (!account || !account.access_token || account.access_token === 'mock_token') {
                    errors.push(`[${platform}] No valid API credentials connected.`);
                    continue;
                }

                try {
                    // Strict Duplicate Check (Global Lock)
                    const isDuplicate = await new Promise((resolve, reject) => {
                        db.run(`INSERT INTO uploaded_videos (video_hash, platform, upload_status) VALUES (?, ?, 'uploading')`, [videoHash, platform], function(err) {
                            if (err) {
                                // Unique constraint violation -> Already uploading or uploaded
                                resolve(true);
                            } else {
                                resolve(false);
                            }
                        });
                    });

                    if (isDuplicate) {
                        errors.push(`[${platform}] Blocked: Video already uploaded globally.`);
                        continue; // Skip uploading to this platform
                    }

                    // Decrypt Tokens
                    account.access_token = decrypt(account.access_token);
                    account.refresh_token = decrypt(account.refresh_token);

                    // 1. Validate Video with temp path
                    await validateVideo(tempVideoPath, platform);

                    // 2. Upload using local file
                    if (platform === 'youtube') {
                        await uploadToYouTube(post, account, tempVideoPath);
                        successCount++;
                    } else if (platform === 'x') {
                        await uploadToTwitter(post, account, tempVideoPath);
                        successCount++;
                    } else if (platform === 'tiktok') {
                        await uploadToTikTok(post, account, tempVideoPath);
                        successCount++;
                    } else if (platform === 'instagram') {
                        await uploadToInstagram(post, account, tempVideoPath);
                        successCount++;
                    } else {
                        errors.push(`[${platform}] Platform SDK not implemented yet.`);
                    }
                    
                    // Mark as successfully uploaded in the global registry
                    db.run(`UPDATE uploaded_videos SET upload_status = 'completed' WHERE video_hash = ?`, [videoHash]);

                } catch (err) {
                    errors.push(`[${platform}] ${err.message || 'Unknown error'}`);
                    // Critical: Release the global lock on failure so the file can be retried
                    db.run(`DELETE FROM uploaded_videos WHERE video_hash = ?`, [videoHash]);
                }
            }

            // Cleanup local temp file
            if (tempVideoPath && fs.existsSync(tempVideoPath)) {
                fs.unlinkSync(tempVideoPath);
            }

            // Status updating logic
            if (successCount === platforms.length && platforms.length > 0) {
                db.run(`UPDATE posts SET status = 'uploaded', error_message = NULL WHERE id = ?`, [post.id]);
                console.log(`[Queue] Successfully uploaded post ${post.id} to all platforms.`);
            } else {
                const nextRetry = post.retry_count + 1;
                const errorStr = errors.join(' | ');

                // If some uploads were blocked due to duplicates, mark it as failed to notify user.
                if (nextRetry > 3 || successCount > 0) {
                    db.run(`UPDATE posts SET status = 'failed', error_message = ? WHERE id = ?`, [errorStr.substring(0, 200), post.id]);
                    console.log(`[Queue] Post ${post.id} completed with partial failures or permanent failures.`);
                } else {
                    db.run(`UPDATE posts SET status = 'pending', retry_count = ?, scheduled_time = datetime('now', '+15 minutes', 'localtime'), error_message = ? WHERE id = ?`, 
                        [nextRetry, errorStr.substring(0, 200), post.id]);
                    console.log(`[Queue] Post ${post.id} failed. Retrying... (${nextRetry}/3)`);
                }
            }
        });
    });
};

const startQueueWorker = () => {
    setInterval(processQueue, 15000);
    console.log("[Queue] Worker started. Checking every 15 seconds.");
};

module.exports = { startQueueWorker };
