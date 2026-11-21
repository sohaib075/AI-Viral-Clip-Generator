const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { spawnSync } = require('child_process');

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

let cachedFfmpeg = null;
function findFfmpeg() {
    if (cachedFfmpeg !== null) return cachedFfmpeg;
    if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
        return (cachedFfmpeg = process.env.FFMPEG_PATH);
    }
    try {
        const py = spawnSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], {
            encoding: 'utf8',
            timeout: 3000
        });
        const p = (py.stdout || '').trim();
        if (p && fs.existsSync(p)) return (cachedFfmpeg = p);
    } catch {}
    try {
        const check = spawnSync('ffmpeg', ['-version'], { timeout: 1000 });
        if (check.status === 0) return (cachedFfmpeg = 'ffmpeg');
    } catch {}
    return (cachedFfmpeg = '');
}

function parseWithFfmpeg(videoPath) {
    const exe = findFfmpeg();
    if (!exe) return null;
    try {
        const proc = spawnSync(exe, ['-hide_banner', '-i', videoPath], { encoding: 'utf8', timeout: 5000 });
        const out = proc.stderr || '';
        const durMatch = out.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
        const resMatch = out.match(/Stream.*Video:.*,\s*(\d{2,5})x(\d{2,5})/);
        if (!durMatch) return null;
        const [_, h, m, s] = durMatch;
        const duration = parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseFloat(s);
        let width = resMatch ? parseInt(resMatch[1], 10) : 0;
        let height = resMatch ? parseInt(resMatch[2], 10) : 0;
        const rotMatch = out.match(/rotation of\s*(-?\d+)/) || out.match(/rotate\s*:\s*(-?\d+)/);
        if (rotMatch) {
            const rot = Math.abs(parseInt(rotMatch[1], 10)) % 180;
            if (rot === 90) [width, height] = [height, width];
        }
        return { duration, width, height };
    } catch (e) {
        console.error('[Validator] FFmpeg fallback error:', e.message);
        return null;
    }
}

/**
 * Validates a video file based on the target platform's requirements.
 * @param {string} videoPath - The local path to the video.
 * @param {string} platform - 'youtube', 'tiktok', 'instagram', or 'x'.
 * @returns {Promise<boolean>} Resolves if valid, rejects with Error if invalid.
 */
const validateVideo = (videoPath, platform) => {
    return new Promise((resolve, reject) => {
        const limits = LIMITS[platform];
        let size = 0;
        try {
            if (fs.existsSync(videoPath)) size = fs.statSync(videoPath).size;
        } catch {}

        if (limits?.maxBytes && size > limits.maxBytes) {
            return reject(new Error(`${limits.label} videos must be under ${Math.round(limits.maxBytes / 1024 / 1024)} MB.`));
        }

        const runChecks = (duration, width, height) => {
            console.log(`[Validator] Checking video - Duration: ${duration}s, Res: ${width}x${height}`);

            if (Number.isFinite(duration)) {
                if (limits?.maxSeconds && duration > limits.maxSeconds + 0.5) {
                    const max = limits.maxSeconds % 60 === 0 ? `${limits.maxSeconds / 60} minutes` : `${limits.maxSeconds} seconds`;
                    return reject(new Error(`${limits.label} videos must be ${max} or shorter.`));
                }
                if (limits?.minSeconds && duration < limits.minSeconds) {
                    return reject(new Error(`${limits.label} videos must be at least ${limits.minSeconds} seconds long.`));
                }
            }

            if (limits?.vertical && width && height && width >= height) {
                return reject(new Error(`${limits.label} must be vertical (e.g., 9:16).`));
            }

            return resolve(true);
        };

        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (!err && metadata?.format && metadata?.streams) {
                try {
                    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                    if (videoStream) {
                        const duration = parseFloat(metadata.format.duration);
                        let width = parseInt(videoStream.width, 10);
                        let height = parseInt(videoStream.height, 10);
                        if (Math.abs(getRotation(videoStream)) % 180 === 90) {
                            [width, height] = [height, width];
                        }
                        return runChecks(duration, width, height);
                    }
                } catch (e) {
                    console.error('[Validator] Metadata parsing error:', e);
                }
            }

            // Fallback: Parse duration and resolution using ffmpeg (bundled with python imageio_ffmpeg)
            const fallbackMeta = parseWithFfmpeg(videoPath);
            if (fallbackMeta) {
                return runChecks(fallbackMeta.duration, fallbackMeta.width, fallbackMeta.height);
            }

            // If neither tool is installed on the host, allow the upload to proceed rather than crashing
            console.warn(`[Validator] ffprobe and ffmpeg not available on host. Proceeding with upload for ${videoPath}.`);
            resolve(true);
        });
    });
};

module.exports = { validateVideo };
