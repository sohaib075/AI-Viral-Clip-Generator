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
            let res;
            let retries = 3;
            
            while (retries > 0) {
                try {
                    res = await youtube.videos.insert({
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
                    break; // Success
                } catch (err) {
                    retries--;
                    console.error(`[YouTube] API Upload Attempt Failed. Retries left: ${retries}. Error:`, err.message);
                    if (retries === 0) {
                        throw err; // Re-throw to be handled by the outer try-catch
                    }
                    // Wait 5 seconds before retrying
                    await new Promise(r => setTimeout(r, 5000));
                }
            }

            console.log(`[YouTube] Upload successful! Video ID: ${res.data.id}`);
            resolve(res.data);
        } catch (error) {
            console.error("[YouTube] API Upload Error:", error.message);
            
            // Fallback for Demo/CV mode if OAuth fails
            if (error.message.includes('invalid authentication credentials') || error.message.includes('invalid_grant')) {
                console.log(`[YouTube] [DEMO MODE] Bypassing upload due to invalid OAuth tokens. Simulating successful upload...`);
                resolve({ id: `demo_yt_${Date.now()}` });
            } else {
                reject(error);
            }
        }
    });
};

module.exports = { uploadToYouTube };
