const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

const isAuthError = (err) => {
    const status = err.code || err.response?.status;
    const message = (err.message || '').toLowerCase();
    return status === 401 || message.includes('invalid_grant') || message.includes('invalid authentication credentials');
};

const uploadToYouTube = async (post, account, tempVideoPath) => {
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
    let retries = 3;

    while (true) {
        try {
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
                    mimeType: 'video/mp4',
                    body: fs.createReadStream(tempVideoPath)
                }
            }, {
                timeout: 300000 // 5 minutes timeout
            });

            console.log(`[YouTube] Upload successful! Video ID: ${res.data.id}`);
            return res.data;
        } catch (err) {
            if (isAuthError(err)) {
                // Retrying won't help, and reporting success here would hide a failed upload.
                console.error('[YouTube] Authentication failed:', err.message);
                throw new Error('YouTube credentials are invalid or expired. Reconnect the account and try again.');
            }

            retries--;
            console.error(`[YouTube] API Upload Attempt Failed. Retries left: ${retries}. Error:`, err.message);
            if (retries === 0) {
                throw err;
            }
            // Wait 5 seconds before retrying
            await new Promise(r => setTimeout(r, 5000));
        }
    }
};

module.exports = { uploadToYouTube };
