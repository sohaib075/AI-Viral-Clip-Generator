const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

// TikTok chunks must be 5-64MB; smaller files are sent as a single chunk, and the last chunk absorbs the remainder
const CHUNK_SIZE = 10 * 1024 * 1024;
const API_TIMEOUT_MS = 60 * 1000;
const CHUNK_TIMEOUT_MS = 5 * 60 * 1000;
// TikTok allows 30 status checks per minute per user; stay well below that with several posts at once
const STATUS_POLL_INTERVAL_MS = 10000;
const STATUS_POLL_ATTEMPTS = 60; // Up to 10 minutes

// Most public option first. Set TIKTOK_PRIVACY_LEVEL to require a specific one.
const PRIVACY_PREFERENCE = ['PUBLIC_TO_EVERYONE', 'FOLLOWER_OF_CREATOR', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const tiktokError = (err, fallback) => {
    const apiError = err.response?.data?.error;
    return apiError?.message ? `${fallback}: ${apiError.message} (${apiError.code})` : `${fallback}: ${err.message}`;
};

const choosePrivacyLevel = (options) => {
    const configured = process.env.TIKTOK_PRIVACY_LEVEL;
    if (configured) {
        if (options.includes(configured)) return configured;
        throw Object.assign(new Error(`TikTok doesn't allow ${configured} for this account (allowed: ${options.join(', ')}). Update TIKTOK_PRIVACY_LEVEL.`), { retryable: false });
    }
    const level = PRIVACY_PREFERENCE.find(option => options.includes(option));
    if (!level) throw new Error('TikTok did not return any allowed privacy levels for this account.');
    return level;
};

const uploadToTikTok = async (post, account, tempVideoPath) => {
    const videoSize = fs.statSync(tempVideoPath).size;
    const chunkSize = Math.min(CHUNK_SIZE, videoSize);
    const totalChunks = Math.max(1, Math.floor(videoSize / chunkSize));
    const headers = {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json; charset=UTF-8'
    };

    // 1. Ask which settings this creator may use
    let creator;
    try {
        const creatorRes = await axios.post('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {}, { headers, timeout: API_TIMEOUT_MS });
        creator = creatorRes.data.data || {};
    } catch (err) {
        throw new Error(tiktokError(err, 'Could not load TikTok account settings'));
    }
    const privacyLevel = choosePrivacyLevel(creator.privacy_level_options || []);

    // 2. Initialize upload via TikTok Direct Post API
    console.log(`[TikTok] Initializing upload session (${totalChunks} chunk(s), ${privacyLevel})...`);
    let uploadUrl;
    let publishId;
    try {
        const initRes = await axios.post('https://open.tiktokapis.com/v2/post/publish/video/init/', {
            post_info: {
                title: `${post.title || ''} ${post.hashtags || ''}`.trim().substring(0, 2200),
                privacy_level: privacyLevel,
                disable_duet: Boolean(creator.duet_disabled),
                disable_comment: Boolean(creator.comment_disabled),
                disable_stitch: Boolean(creator.stitch_disabled),
                video_cover_timestamp_ms: 1000
            },
            source_info: {
                source: "FILE_UPLOAD",
                video_size: videoSize,
                chunk_size: chunkSize,
                total_chunk_count: totalChunks
            }
        }, { headers, timeout: API_TIMEOUT_MS });
        ({ upload_url: uploadUrl, publish_id: publishId } = initRes.data.data || {});
    } catch (err) {
        throw new Error(tiktokError(err, 'TikTok rejected the upload'));
    }
    if (!uploadUrl) {
        throw new Error('TikTok did not return an upload URL.');
    }

    // 3. Upload the video in chunks (TikTok only publishes once every chunk has arrived)
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
                maxBodyLength: Infinity,
                timeout: CHUNK_TIMEOUT_MS
            });
        }
    } catch (err) {
        throw new Error(tiktokError(err, 'Uploading the video to TikTok failed'));
    } finally {
        fs.closeSync(fd);
    }

    // 4. Wait until TikTok has processed and published the video. From here on the video may go live
    //    even if we can't confirm it, so failures to check are reported as "may have published".
    let lastCheckError = null;
    for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt++) {
        await sleep(STATUS_POLL_INTERVAL_MS);
        let statusRes;
        try {
            statusRes = await axios.post('https://open.tiktokapis.com/v2/post/publish/status/fetch/',
                { publish_id: publishId }, { headers, timeout: API_TIMEOUT_MS });
        } catch (err) {
            // Rate limits and network hiccups: keep checking
            lastCheckError = tiktokError(err, 'status check failed');
            continue;
        }

        const { status, fail_reason: failReason } = statusRes.data.data || {};
        if (status === 'PUBLISH_COMPLETE') {
            console.log(`[TikTok] Upload successful! Publish ID: ${publishId}`);
            return { publish_id: publishId };
        }
        if (status === 'FAILED') {
            // TikTok refused the video, so it won't go live; only internal errors are worth retrying
            throw Object.assign(new Error(`TikTok could not publish the video: ${failReason || 'unknown reason'}`),
                { retryable: failReason === 'internal' });
        }
    }

    throw Object.assign(
        new Error(`TikTok had not confirmed the post after 10 minutes${lastCheckError ? ` (${lastCheckError})` : ''}.`),
        { mayHavePublished: true }
    );
};

module.exports = { uploadToTikTok, choosePrivacyLevel };
