const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');

const MAX_TWEET_WEIGHT = 280;
const CHUNK_SIZE = 1024 * 1024;
const MAX_VIDEO_BYTES = 512 * 1024 * 1024;

// X counts most Latin, Cyrillic etc. characters as 1 and others (CJK, emoji) as 2
const characterWeight = (codePoint) => (
    codePoint <= 0x10FF ||
    (codePoint >= 0x2000 && codePoint <= 0x200D) ||
    (codePoint >= 0x2010 && codePoint <= 0x201F) ||
    (codePoint >= 0x2032 && codePoint <= 0x2037)
) ? 1 : 2;

// Truncates by X's weighted length without splitting emoji or other surrogate pairs
const truncateTweet = (text) => {
    let weight = 0;
    let result = '';
    for (const char of text) {
        weight += characterWeight(char.codePointAt(0));
        if (weight > MAX_TWEET_WEIGHT) break;
        result += char;
    }
    return result;
};

// Chunked v2 media upload reading from disk so large clips never load fully into RAM
const uploadMediaFromPath = async (client, filePath) => {
    const { size } = await fs.promises.stat(filePath);
    if (size > MAX_VIDEO_BYTES) {
        throw new Error(`Video is too large for X (max ${MAX_VIDEO_BYTES / (1024 * 1024)} MB).`);
    }

    const initResponse = await client.v2.post('media/upload/initialize', {
        media_type: 'video/mp4',
        media_category: 'tweet_video',
        total_bytes: size,
    });
    const mediaId = initResponse.data.id;
    const handle = await fs.promises.open(filePath, 'r');
    try {
        const buffer = Buffer.alloc(Math.min(CHUNK_SIZE, size));
        let offset = 0;
        let segmentIndex = 0;
        while (offset < size) {
            const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
            if (bytesRead === 0) break;
            await client.v2.post(
                `media/upload/${mediaId}/append`,
                { segment_index: segmentIndex, media: buffer.subarray(0, bytesRead) },
                { forceBodyMode: 'form-data' }
            );
            offset += bytesRead;
            segmentIndex += 1;
        }
    } finally {
        await handle.close();
    }

    const finalizeResponse = await client.v2.post(`media/upload/${mediaId}/finalize`);
    if (finalizeResponse.data?.processing_info) {
        await waitForMediaProcessing(client, mediaId);
    }
    return mediaId;
};

const waitForMediaProcessing = async (client, mediaId) => {
    const response = await client.v2.get('media/upload', {
        command: 'STATUS',
        media_id: mediaId,
    });
    const info = response.data?.processing_info;
    if (!info) return;
    if (info.state === 'succeeded') return;
    if (info.state === 'failed') {
        throw new Error(`Media processing failed: ${info.error?.message || 'unknown error'}`);
    }
    const waitTime = info.check_after_secs || 1;
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    await waitForMediaProcessing(client, mediaId);
};

const uploadToTwitter = async (post, account, tempVideoPath) => {
    // The account holds an OAuth 2.0 user token, which the v1.1 media endpoint rejects,
    // so media goes through API v2 (needs the media.write scope). This waits for video processing.
    const client = new TwitterApi(account.access_token);

    console.log(`[X/Twitter] Starting media upload for account ${account.account_name}...`);
    const mediaId = await uploadMediaFromPath(client, tempVideoPath);

    console.log(`[X/Twitter] Posting tweet...`);
    const tweetContent = [post.title, post.description, post.hashtags].filter(Boolean).join('\n\n');

    try {
        const tweetResponse = await client.v2.tweet({
            text: truncateTweet(tweetContent),
            media: { media_ids: [mediaId] }
        });
        console.log(`[X/Twitter] Tweet successful! Tweet ID: ${tweetResponse.data.id}`);
        return tweetResponse.data;
    } catch (err) {
        // A request error without an HTTP response means X may have created the tweet anyway
        if (typeof err.code !== 'number') {
            throw Object.assign(new Error(`Posting to X was interrupted (${err.message}).`), { mayHavePublished: true });
        }
        throw err;
    }
};

module.exports = { uploadToTwitter, truncateTweet };
