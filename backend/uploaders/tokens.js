const axios = require('axios');
const { TwitterApi } = require('twitter-api-v2');
const db = require('../db');
const { encrypt, decrypt } = require('../crypto');
require('dotenv').config();

const API_TIMEOUT_MS = 30000;
// A token refreshed this recently (e.g. by another post a moment ago) is reused instead of refreshed again
const REUSE_REFRESHED_TOKEN_MS = 5 * 60 * 1000;

// Rejected by the provider (as opposed to a network problem or rate limit): the account must be reconnected
const rejected = (message) => Object.assign(new Error(message), { status: 400 });

// X (2 hours) and TikTok (24 hours) access tokens are short-lived, so they're refreshed before
// every upload. Both providers may rotate the refresh token as well.
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
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: API_TIMEOUT_MS });

        if (!res.data.access_token) {
            throw rejected(res.data.error_description || res.data.error || 'No access token returned');
        }
        return { accessToken: res.data.access_token, refreshToken: res.data.refresh_token };
    }
};

// Saves new tokens for an account (used after refreshes, including ones done by the Google client)
const saveAccountTokens = async (accountId, { accessToken, refreshToken }) => {
    if (refreshToken) {
        await db.runAsync(`UPDATE accounts SET access_token = ?, refresh_token = ? WHERE id = ?`,
            [encrypt(accessToken), encrypt(refreshToken), accountId]);
    } else {
        await db.runAsync(`UPDATE accounts SET access_token = ? WHERE id = ?`, [encrypt(accessToken), accountId]);
    }
};

const lastRefreshedAt = new Map();

const refreshNow = async (account, refresh) => {
    // Read the latest tokens: another post may have just rotated them
    const row = await db.getAsync(`SELECT access_token, refresh_token FROM accounts WHERE id = ?`, [account.id]);
    if (!row) {
        throw Object.assign(new Error('The account was disconnected.'), { retryable: false });
    }
    const storedAccessToken = decrypt(row.access_token);
    const storedRefreshToken = decrypt(row.refresh_token);

    if (storedAccessToken && Date.now() - (lastRefreshedAt.get(account.id) || 0) < REUSE_REFRESHED_TOKEN_MS) {
        account.access_token = storedAccessToken;
        account.refresh_token = storedRefreshToken;
        return account;
    }
    if (!storedRefreshToken) {
        throw Object.assign(new Error('No refresh token stored. Reconnect the account.'), { retryable: false });
    }

    let tokens;
    try {
        tokens = await refresh(storedRefreshToken);
    } catch (err) {
        // twitter-api-v2 puts the HTTP status in `code`; axios in `response.status`
        const status = err.status || err.response?.status || (typeof err.code === 'number' ? err.code : undefined);
        console.error(`[Tokens] ${account.platform} token refresh failed:`, err.response?.data || err.data || err.message);
        if (status === 400 || status === 401) {
            throw Object.assign(new Error('Could not refresh the access token. Reconnect the account.'), { retryable: false });
        }
        // Rate limits, server errors and network problems are worth retrying later
        throw new Error(`Could not refresh the access token: ${err.message}`);
    }

    account.access_token = tokens.accessToken;
    account.refresh_token = tokens.refreshToken || storedRefreshToken;
    await saveAccountTokens(account.id, { accessToken: account.access_token, refreshToken: account.refresh_token });
    lastRefreshedAt.set(account.id, Date.now());
    return account;
};

// Refreshes run one at a time per account: X refresh tokens are single-use, so two posts
// published together must not both spend the same one.
const refreshLocks = new Map();

// Refreshes the account's tokens in place (and in the database) for platforms that need it.
// Errors carry `retryable: false` when retrying won't help and the account must be reconnected.
const refreshAccessToken = (account) => {
    const refresh = refreshers[account.platform];
    if (!refresh) return Promise.resolve(account);

    const previous = refreshLocks.get(account.id) || Promise.resolve();
    const current = previous.catch(() => {}).then(() => refreshNow(account, refresh));
    refreshLocks.set(account.id, current);
    return current.finally(() => {
        if (refreshLocks.get(account.id) === current) refreshLocks.delete(account.id);
    });
};

module.exports = { refreshAccessToken, saveAccountTokens };
