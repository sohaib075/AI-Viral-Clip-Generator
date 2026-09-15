const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');

const MAX_TWEET_WEIGHT = 280;

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

const uploadToTwitter = async (post, account, tempVideoPath) => {
    // The account holds an OAuth 2.0 user token, which the v1.1 media endpoint rejects,
    // so media goes through API v2 (needs the media.write scope). This waits for video processing.
    const client = new TwitterApi(account.access_token);

    console.log(`[X/Twitter] Starting media upload for account ${account.account_name}...`);
    const mediaId = await client.v2.uploadMedia(fs.readFileSync(tempVideoPath), {
        media_type: 'video/mp4',
        media_category: 'tweet_video'
    });

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
