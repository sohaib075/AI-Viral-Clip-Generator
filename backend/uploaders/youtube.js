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

    // Actively refresh the access token before uploading to prevent expired token rejections
    try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        if (credentials.access_token) {
            oauth2Client.setCredentials(credentials);
            account.access_token = credentials.access_token;
            account.refresh_token = credentials.refresh_token || account.refresh_token;
            await saveAccountTokens(account.id, {
                accessToken: credentials.access_token,
                refreshToken: credentials.refresh_token || account.refresh_token
            });
            console.log('[YouTube] Refreshed access token successfully before upload.');
        }
    } catch (refreshErr) {
        console.warn('[YouTube] Proactive token refresh notice:', refreshErr.message);
    }

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
                timeout: 1800000 // 30 minutes timeout for large video uploads
            });

            console.log(`[YouTube] Upload successful! Video ID: ${res.data.id}`);
            return res.data;
        } catch (err) {
            if (isAuthError(err)) {
                if (retries > 1 && account.refresh_token) {
                    console.log('[YouTube] Auth failed, attempting refresh before retry...');
                    try {
                        const { credentials } = await oauth2Client.refreshAccessToken();
                        oauth2Client.setCredentials(credentials);
                        if (credentials.access_token) {
                            account.access_token = credentials.access_token;
                            await saveAccountTokens(account.id, {
                                accessToken: credentials.access_token,
                                refreshToken: credentials.refresh_token || account.refresh_token
                            });
                        }
                        retries--;
                        continue;
                    } catch (refreshErr) {
                        console.error('[YouTube] Refresh attempt during retry failed:', refreshErr.message);
                    }
                }
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
