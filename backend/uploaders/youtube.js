const { google } = require('googleapis');
const fs = require('fs');
const { saveAccountTokens } = require('./tokens');
require('dotenv').config();

const PRIVACY_STATUSES = ['public', 'unlisted', 'private'];
const PRIVACY_STATUS = PRIVACY_STATUSES.includes(process.env.YOUTUBE_PRIVACY_STATUS) ? process.env.YOUTUBE_PRIVACY_STATUS : 'public';

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

    // The client refreshes expired access tokens on its own; keep the new ones
    oauth2Client.on('tokens', (tokens) => {
        if (!tokens.access_token) return;
        saveAccountTokens(account.id, { accessToken: tokens.access_token, refreshToken: tokens.refresh_token })
            .catch(err => console.error('[YouTube] Failed to save refreshed tokens:', err.message));
    });

    const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client
    });

    const tags = (post.hashtags || '').split(/[\s,]+/).map(t => t.replace(/^#/, '')).filter(Boolean);
    const description = [post.description, post.hashtags, '#shorts'].filter(Boolean).join('\n\n');

    console.log(`[YouTube] Starting upload to YouTube Shorts for account ${account.account_name}...`);
    let retries = 3;

    while (true) {
        try {
            const res = await youtube.videos.insert({
                part: 'snippet,status',
                requestBody: {
                    snippet: {
                        title: (post.title || 'New Short').slice(0, 100),
                        description: description.slice(0, 5000),
                        tags,
                    },
                    status: {
                        privacyStatus: PRIVACY_STATUS,
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
                throw Object.assign(new Error('YouTube credentials are invalid or expired. Reconnect the account and try again.'), { retryable: false });
            }

            const status = err.response?.status;
            if (!status && ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(err.code)) {
                // Never reached YouTube, so nothing was published
                throw err;
            }
            if (!status) {
                // No response (timeout, dropped connection): YouTube may have received the whole video
                console.error('[YouTube] Upload interrupted:', err.message);
                throw Object.assign(new Error(`The YouTube upload was interrupted (${err.message}).`), { mayHavePublished: true });
            }

            retries--;
            console.error(`[YouTube] API Upload Attempt Failed. Retries left: ${retries}. Error:`, err.message);
            // Only server-side failures are worth retrying straight away
            if (retries === 0 || status < 500) {
                throw err;
            }
            // Wait 5 seconds before retrying
            await new Promise(r => setTimeout(r, 5000));
        }
    }
};

module.exports = { uploadToYouTube };
