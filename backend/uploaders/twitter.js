const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

const uploadToTwitter = async (post, account, tempVideoPath) => {
    return new Promise(async (resolve, reject) => {
        try {
            const client = new TwitterApi(account.access_token);
            
            console.log(`[X/Twitter] Starting media upload for account ${account.account_name}...`);
            
            // 1. Upload Media (Video) using Chunked Upload
            const mediaId = await client.v1.uploadMedia(tempVideoPath, { type: 'video/mp4' });
            
            // 2. Create Tweet
            console.log(`[X/Twitter] Posting tweet...`);
            const tweetContent = `${post.title}\n\n${post.description}\n\n${post.hashtags}`;
            
            const tweetResponse = await client.v2.tweet({
                text: tweetContent.substring(0, 280), // Twitter char limit
                media: { media_ids: [mediaId] }
            });

            console.log(`[X/Twitter] Tweet successful! Tweet ID: ${tweetResponse.data.id}`);
            resolve(tweetResponse.data);
        } catch (error) {
            console.error("[X/Twitter] API Upload Error:", error.message);
            reject(error);
        }
    });
};

module.exports = { uploadToTwitter };
