const axios = require('axios');
const fs = require('fs');

const uploadToTikTok = async (post, account, tempVideoPath) => {
    return new Promise(async (resolve, reject) => {
        try {
            const videoSize = fs.statSync(tempVideoPath).size;

            // 1. Initialize upload via TikTok Direct Post API
            console.log(`[TikTok] Initializing upload session...`);
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
                    chunk_size: videoSize, // Assuming < 50MB for Shorts, we can do 1 chunk
                    total_chunk_count: 1
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${account.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            const uploadUrl = initRes.data.data.upload_url;

            // 2. Upload the video chunk
            console.log(`[TikTok] Uploading video data...`);
            const videoBuffer = fs.readFileSync(tempVideoPath);
            await axios.put(uploadUrl, videoBuffer, {
                headers: {
                    'Content-Type': 'video/mp4',
                    'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`
                }
            });

            // Note: TikTok automatically publishes once all chunks are uploaded.
            console.log(`[TikTok] Upload successful! Publish ID: ${initRes.data.data.publish_id}`);
            resolve({ publish_id: initRes.data.data.publish_id });
        } catch (err) {
            console.error("[TikTok] API Upload Error:", err.response?.data || err.message);
            reject(err);
        }
    });
};

module.exports = { uploadToTikTok };
