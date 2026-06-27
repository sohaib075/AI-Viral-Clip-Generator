const ffmpeg = require('fluent-ffmpeg');

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
                return reject(new Error("Validation failed: Could not read video metadata."));
            }

            try {
                const format = metadata.format;
                const videoStream = metadata.streams.find(s => s.codec_type === 'video');

                if (!videoStream) {
                    return reject(new Error("Validation failed: No video stream found."));
                }

                const duration = parseFloat(format.duration);
                const width = parseInt(videoStream.width);
                const height = parseInt(videoStream.height);
                
                console.log(`[Validator] Checking video - Duration: ${duration}s, Res: ${width}x${height}`);

                // Common Aspect Ratio Check (Allow slight deviations)
                // For 9:16, width / height should be ~0.5625
                const isVertical = width < height;

                if (platform === 'youtube') {
                    // YouTube Shorts: max 60s, must be vertical
                    if (duration > 60.5) return reject(new Error("YouTube Shorts must be under 60 seconds."));
                    if (!isVertical) return reject(new Error("YouTube Shorts must be vertical (e.g., 9:16)."));
                } else if (platform === 'instagram') {
                    // Instagram Reels: max 90s, must be vertical
                    if (duration > 90.5) return reject(new Error("Instagram Reels must be under 90 seconds."));
                    if (!isVertical) return reject(new Error("Instagram Reels must be vertical."));
                } else if (platform === 'tiktok') {
                    // TikTok: up to 10 minutes, usually vertical but not strictly rejected
                    if (duration > 600) return reject(new Error("TikTok videos must be under 10 minutes."));
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
