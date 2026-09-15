const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

// Platform limits for the videos this app publishes
const LIMITS = {
    youtube: { maxSeconds: 180, vertical: true, label: 'YouTube Shorts' },       // Shorts: up to 3 minutes
    instagram: { minSeconds: 3, maxSeconds: 15 * 60, maxBytes: 300 * 1024 * 1024, label: 'Instagram Reels' },
    tiktok: { maxSeconds: 10 * 60, label: 'TikTok' },
    x: { maxSeconds: 140, maxBytes: 512 * 1024 * 1024, label: 'X' },
};

// Phones often store portrait video as landscape frames plus a rotation flag
const getRotation = (videoStream) => {
    const sideData = (videoStream.side_data_list || []).find(d => d.rotation !== undefined);
    return Number(sideData?.rotation ?? videoStream.tags?.rotate ?? 0);
};

/**
 * Validates a video file based on the target platform's requirements.
 * @param {string} videoPath - The local path to the video.
 * @param {string} platform - 'youtube', 'tiktok', 'instagram', or 'x'.
 * @returns {Promise<boolean>} Resolves if valid, rejects with Error if invalid.
 */
const validateVideo = (videoPath, platform) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                console.error(`[Validator] FFprobe error for ${videoPath}:`, err);
                return reject(new Error("Validation failed: Could not read video metadata. Is ffprobe installed?"));
            }

            try {
                const format = metadata.format;
                const videoStream = metadata.streams.find(s => s.codec_type === 'video');

                if (!videoStream) {
                    return reject(new Error("Validation failed: No video stream found."));
                }

                const duration = parseFloat(format.duration);
                let width = parseInt(videoStream.width);
                let height = parseInt(videoStream.height);
                if (Math.abs(getRotation(videoStream)) % 180 === 90) {
                    [width, height] = [height, width];
                }
                const size = fs.statSync(videoPath).size;

                console.log(`[Validator] Checking video - Duration: ${duration}s, Res: ${width}x${height}`);

                if (!Number.isFinite(duration)) {
                    return reject(new Error("Validation failed: Could not determine video duration."));
                }

                const limits = LIMITS[platform];
                if (!limits) return resolve(true);

                if (limits.maxSeconds && duration > limits.maxSeconds + 0.5) {
                    const max = limits.maxSeconds % 60 === 0 ? `${limits.maxSeconds / 60} minutes` : `${limits.maxSeconds} seconds`;
                    return reject(new Error(`${limits.label} videos must be ${max} or shorter.`));
                }
                if (limits.minSeconds && duration < limits.minSeconds) {
                    return reject(new Error(`${limits.label} videos must be at least ${limits.minSeconds} seconds long.`));
                }
                if (limits.maxBytes && size > limits.maxBytes) {
                    return reject(new Error(`${limits.label} videos must be under ${Math.round(limits.maxBytes / 1024 / 1024)} MB.`));
                }
                if (limits.vertical && width >= height) {
                    return reject(new Error(`${limits.label} must be vertical (e.g., 9:16).`));
                }

                resolve(true);
            } catch (e) {
                console.error("[Validator] Metadata parsing error:", e);
                reject(new Error("Validation failed: Corrupted metadata."));
            }
        });
    });
};

module.exports = { validateVideo };
