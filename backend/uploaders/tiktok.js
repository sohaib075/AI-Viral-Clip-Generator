const axios = require('axios');
const fs = require('fs');

// TikTok chunks must be 5-64MB; files under 5MB are sent as a single chunk,
// and the last chunk absorbs the remainder.
const MIN_CHUNK_SIZE = 5 * 1024 * 1024;
const CHUNK_SIZE = 10 * 1024 * 1024;
const STATUS_POLL_INTERVAL_MS = 5000;
const STATUS_POLL_ATTEMPTS = 60; // Up to 5 minutes

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const uploadToTikTok = async (post, account, tempVideoPath) => {
    const videoSize = fs.statSync(tempVideoPath).size;
    const chunkSize = videoSize < MIN_CHUNK_SIZE ? videoSize : CHUNK_SIZE;
    const totalChunks = Math.max(1, Math.floor(videoSize / chunkSize));
    const headers = {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json; charset=UTF-8'
    };

    try {
        // 1. Initialize upload via TikTok Direct Post API
        console.log(`[TikTok] Initializing upload session (${totalChunks} chunk(s))...`);
        const initRes = await axios.post('https://open.tiktokapis.com/v2/post/publish/video/init/', {
            post_info: {
                title: `${post.title} ${post.hashtags || ''}`.substring(0, 150),
                privacy_level: "MUTUAL_FOLLOW_FRIENDS", // Using private-ish for testing. Change to PUBLIC_TO_EVERYONE
                disable_duet: false,
                disable_comment: false,
                disable_stitch: false,
                video_cover_timestamp_ms: 1000
            },
            source_info: {
                source: "FILE_UPLOAD",
                video_size: videoSize,
                chunk_size: chunkSize,
                total_chunk_count: totalChunks
            }
        }, { headers });

        const { upload_url: uploadUrl, publish_id: publishId } = initRes.data.data || {};
        if (!uploadUrl) {
            throw new Error(`TikTok did not return an upload URL: ${JSON.stringify(initRes.data.error || initRes.data)}`);
        }

        // 2. Upload the video in chunks
        console.log(`[TikTok] Uploading video data...`);
        const fd = fs.openSync(tempVideoPath, 'r');
        try {
            for (let i = 0; i < totalChunks; i++) {
                const start = i * chunkSize;
                const end = i === totalChunks - 1 ? videoSize - 1 : start + chunkSize - 1;
                const chunk = Buffer.alloc(end - start + 1);
                fs.readSync(fd, chunk, 0, chunk.length, start);
                await axios.put(uploadUrl, chunk, {
                    headers: {
                        'Content-Type': 'video/mp4',
                        'Content-Length': chunk.length,
                        'Content-Range': `bytes ${start}-${end}/${videoSize}`
                    },
                    maxBodyLength: Infinity
                });
            }
        } finally {
            fs.closeSync(fd);
        }

        // 3. Wait until TikTok has processed and published the video
        for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt++) {
            await sleep(STATUS_POLL_INTERVAL_MS);
            const statusRes = await axios.post('https://open.tiktokapis.com/v2/post/publish/status/fetch/',
                { publish_id: publishId }, { headers });
            const { status, fail_reason: failReason } = statusRes.data.data || {};

            if (status === 'PUBLISH_COMPLETE') {
                console.log(`[TikTok] Upload successful! Publish ID: ${publishId}`);
                return { publish_id: publishId };
            }
            if (status === 'FAILED') {
                throw new Error(`TikTok could not publish the video: ${failReason || 'unknown reason'}`);
            }
        }
        throw new Error('Timed out waiting for TikTok to publish the video.');
    } catch (err) {
        console.error("[TikTok] API Upload Error:", err.response?.data || err.message);
        throw err;
    }
};

module.exports = { uploadToTikTok };
