const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');

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

    const tweetResponse = await client.v2.tweet({
        text: tweetContent.substring(0, 280), // Twitter char limit
        media: { media_ids: [mediaId] }
    });

    console.log(`[X/Twitter] Tweet successful! Tweet ID: ${tweetResponse.data.id}`);
    return tweetResponse.data;
};

module.exports = { uploadToTwitter };
