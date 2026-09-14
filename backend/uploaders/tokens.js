const axios = require('axios');
const { TwitterApi } = require('twitter-api-v2');
const db = require('../db');
const { encrypt } = require('../crypto');
require('dotenv').config();

// X (2 hours) and TikTok (24 hours) access tokens are short-lived, so they're refreshed before
// every upload. Both providers may rotate the refresh token as well, so the new pair is saved right away.
const refreshers = {
    x: async (refreshToken) => {
        const client = new TwitterApi({
            clientId: process.env.X_CLIENT_ID,
            clientSecret: process.env.X_CLIENT_SECRET,
        });
        const { accessToken, refreshToken: newRefreshToken } = await client.refreshOAuth2Token(refreshToken);
        return { accessToken, refreshToken: newRefreshToken };
    },
    tiktok: async (refreshToken) => {
        const res = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', new URLSearchParams({
            client_key: process.env.TIKTOK_CLIENT_KEY,
            client_secret: process.env.TIKTOK_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        if (!res.data.access_token) {
            const err = new Error(res.data.error_description || res.data.error || 'No access token returned');
            err.response = res; // Rejected by TikTok, not a network problem
            throw err;
        }
        return { accessToken: res.data.access_token, refreshToken: res.data.refresh_token };
    }
};

// Refreshes the account's tokens in place (and in the database) for platforms that need it.
// Errors carry `retryable: false` when retrying won't help and the account must be reconnected.
const refreshAccessToken = async (account) => {
    const refresh = refreshers[account.platform];
    if (!refresh) return account;

    if (!account.refresh_token) {
        throw Object.assign(new Error('No refresh token stored. Reconnect the account.'), { retryable: false });
    }

    let tokens;
    try {
        tokens = await refresh(account.refresh_token);
    } catch (err) {
        console.error(`[Tokens] ${account.platform} token refresh failed:`, err.response?.data || err.message);
        if (err.response) {
            throw Object.assign(new Error('Could not refresh the access token. Reconnect the account.'), { retryable: false });
        }
        throw new Error(`Could not refresh the access token: ${err.message}`);
    }

    account.access_token = tokens.accessToken;
    account.refresh_token = tokens.refreshToken || account.refresh_token;
    await db.runAsync(`UPDATE accounts SET access_token = ?, refresh_token = ? WHERE id = ?`,
        [encrypt(account.access_token), encrypt(account.refresh_token), account.id]);
    return account;
};

module.exports = { refreshAccessToken };
