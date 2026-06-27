const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

const uploadToYouTube = async (post, account, tempVideoPath) => {
    return new Promise(async (resolve, reject) => {
        try {
            const oauth2Client = new google.auth.OAuth2(
                process.env.YOUTUBE_CLIENT_ID,
                process.env.YOUTUBE_CLIENT_SECRET
            );

            // Set the token
            oauth2Client.setCredentials({
                access_token: account.access_token,
                refresh_token: account.refresh_token
            });

            const youtube = google.youtube({
                version: 'v3',
                auth: oauth2Client
            });

            console.log(`[YouTube] Starting upload to YouTube Shorts for account ${account.account_name}...`);
            const res = await youtube.videos.insert({
                part: 'snippet,status',
                requestBody: {
                    snippet: {
                        title: post.title,
                        description: `${post.description}\n\n${post.hashtags}\n#shorts`,
                        tags: post.hashtags ? post.hashtags.replace(/#/g, '').split(' ') : [],
                    },
                    status: {
                        privacyStatus: 'public', // Change to 'private' or 'unlisted' for testing
                        selfDeclaredMadeForKids: false
                    }
                },
                media: {
                    body: fs.createReadStream(tempVideoPath)
                }
            });

            console.log(`[YouTube] Upload successful! Video ID: ${res.data.id}`);
            resolve(res.data);
        } catch (error) {
            console.error("[YouTube] API Upload Error:", error.message);
            reject(error);
        }
    });
};

module.exports = { uploadToYouTube };
