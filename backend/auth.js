const express = require('express');
const { google } = require('googleapis');
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const { randomBytes } = require('crypto');
const db = require('./db');
const httpError = require('./httpError');
const { encrypt } = require('./crypto');
const { GRAPH_VERSION } = require('./uploaders/instagram');
const { isAllowedOrigin, tokenRequired } = require('./security');
require('dotenv').config();

const router = express.Router();

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
const YOUTUBE_REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI || `${BASE_URL}/auth/youtube/callback`;
const API_TIMEOUT_MS = 30000;

const CONNECTABLE_PLATFORMS = ['youtube', 'x', 'tiktok', 'instagram'];
const DEFAULT_RETURN_TO = `${FRONTEND_URL}/accounts`;
// Besides the web app, flows may return to the mobile app's URL scheme or Expo Go during development
const APP_SCHEMES = [`${process.env.MOBILE_APP_SCHEME || 'mobileapp'}://`, 'exp://', 'exps://'];

// ---------------------------------------------------------------------------
// Pending flows and tickets, keyed by a random value. OAuth `state` is checked on the callback so
// another site can't complete a flow with its own authorization code (CSRF).
// ---------------------------------------------------------------------------
const STATE_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING_STATES = 1000;
const pendingStates = new Map();

function createState(kind, data = {}, state = randomBytes(24).toString('hex')) {
    const now = Date.now();
    // Entries are in insertion order, so expired ones are at the front
    for (const [key, entry] of pendingStates) {
        if (now - entry.createdAt <= STATE_TTL_MS) break;
        pendingStates.delete(key);
    }
    if (pendingStates.size >= MAX_PENDING_STATES) {
        pendingStates.delete(pendingStates.keys().next().value);
    }
    pendingStates.set(state, { kind, data, createdAt: now });
    return state;
}

// Returns the data stored with the state, or null if it is unknown, expired or of another kind
function consumeState(kind, state) {
    const entry = typeof state === 'string' ? pendingStates.get(state) : undefined;
    if (!entry) return null;
    pendingStates.delete(state);
    if (entry.kind !== kind || Date.now() - entry.createdAt > STATE_TTL_MS) return null;
    return entry.data;
}

function safeReturnTo(value) {
    if (typeof value !== 'string' || !value) return DEFAULT_RETURN_TO;
    if (APP_SCHEMES.some(scheme => value.startsWith(scheme))) return value;
    try {
        const url = new URL(value);
        if ((url.protocol === 'http:' || url.protocol === 'https:') && isAllowedOrigin(url.origin)) return url.toString();
    } catch (e) {}
    return DEFAULT_RETURN_TO;
}

// Sends the browser back to where the flow started with ?connected=<platform> or ?error=<code>
function finishFlow(res, returnTo, params) {
    let url;
    try {
        url = new URL(returnTo);
    } catch (e) {
        url = new URL(DEFAULT_RETURN_TO);
    }
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    res.redirect(url.toString());
}

function failureCode(error) {
    return /ENCRYPTION_KEY/.test(error.message) ? 'encryption_key_missing' : 'oauth_failed';
}

// Issued to an authenticated client right before it opens /auth/:platform in a browser
function createOAuthTicket(platform, returnTo) {
    if (!CONNECTABLE_PLATFORMS.includes(platform)) {
        throw httpError(400, `Connecting ${platform} isn't supported.`);
    }
    return { ticket: createState('ticket', { platform, returnTo: safeReturnTo(returnTo) }) };
}

function requireEnv(...names) {
    const missing = names.filter(name => !process.env[name]);
    if (missing.length > 0) throw new Error(`Missing ${missing.join(', ')}`);
}

// Reconnecting the same account replaces its row instead of adding a duplicate
async function saveAccount(platform, accountName, accessToken, refreshToken) {
    const encryptedAccess = encrypt(accessToken);
    const encryptedRefresh = encrypt(refreshToken || '');
    await db.runAsync(`DELETE FROM accounts WHERE platform = ? AND account_name = ?`, [platform, accountName]);
    await db.runAsync(`INSERT INTO accounts (id, platform, account_name, access_token, refresh_token) VALUES (?, ?, ?, ?, ?)`,
        [`acc_${platform}_${Date.now()}_${randomBytes(3).toString('hex')}`, platform, accountName, encryptedAccess, encryptedRefresh]);
}

function getYouTubeOAuthClient() {
    requireEnv('YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET');
    return new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI);
}

function getXClient() {
    requireEnv('X_CLIENT_ID', 'X_CLIENT_SECRET');
    return new TwitterApi({ clientId: process.env.X_CLIENT_ID, clientSecret: process.env.X_CLIENT_SECRET });
}

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

// Shared callback handling: validates state, handles a cancelled consent screen, and reports the outcome
function callback(platform, connect) {
    return async (req, res) => {
        const flow = consumeState(platform, req.query.state);
        if (!flow) return finishFlow(res, DEFAULT_RETURN_TO, { error: 'invalid_state' });
        if (req.query.error || !req.query.code) return finishFlow(res, flow.returnTo, { error: 'access_denied' });

        try {
            await connect(req.query.code, flow);
            finishFlow(res, flow.returnTo, { connected: platform });
        } catch (e) {
            console.error(`${platform} OAuth callback error:`, e.response?.data || e.message);
            finishFlow(res, flow.returnTo, { error: failureCode(e) });
        }
    };
}

// YOUTUBE (Google)
router.get('/youtube/callback', callback('youtube', async (code) => {
    const oauth2Client = getYouTubeOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user profile to get account name
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get({ timeout: API_TIMEOUT_MS });
    await saveAccount('youtube', userInfo.data.name || 'YouTube account', tokens.access_token, tokens.refresh_token);
}));

// X (Twitter) OAuth 2.0 with PKCE; the codeVerifier is kept with the state until the callback
router.get('/x/callback', callback('x', async (code, flow) => {
    const { client: loggedClient, accessToken, refreshToken } = await getXClient().loginWithOAuth2({
        code,
        codeVerifier: flow.codeVerifier,
        redirectUri: `${BASE_URL}/auth/x/callback`,
    });
    const user = await loggedClient.v2.me();
    await saveAccount('x', `@${user.data.username}`, accessToken, refreshToken);
}));

// TIKTOK
router.get('/tiktok/callback', callback('tiktok', async (code) => {
    requireEnv('TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET');
    const tokenRes = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${BASE_URL}/auth/tiktok/callback`
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: API_TIMEOUT_MS });

    const { access_token: accessToken, refresh_token: refreshToken } = tokenRes.data;
    if (!accessToken) {
        throw new Error(tokenRes.data.error_description || tokenRes.data.error || 'TikTok returned no access token');
    }

    const userRes = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
        params: { fields: 'display_name' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: API_TIMEOUT_MS
    }).catch(() => null);
    const displayName = userRes?.data?.data?.user?.display_name;
    await saveAccount('tiktok', displayName || 'TikTok account', accessToken, refreshToken);
}));

// INSTAGRAM (Meta Graph API)
router.get('/instagram/callback', callback('instagram', async (code) => {
    requireEnv('INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET');
    const graph = `https://graph.facebook.com/${GRAPH_VERSION}`;

    // 1. Exchange code for short-lived access token
    const tokenRes = await axios.get(`${graph}/oauth/access_token`, {
        params: {
            client_id: process.env.INSTAGRAM_CLIENT_ID,
            client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
            redirect_uri: `${BASE_URL}/auth/instagram/callback`,
            code
        },
        timeout: API_TIMEOUT_MS
    });

    // 2. Exchange for long-lived access token
    const longTokenRes = await axios.get(`${graph}/oauth/access_token`, {
        params: {
            grant_type: 'fb_exchange_token',
            client_id: process.env.INSTAGRAM_CLIENT_ID,
            client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
            fb_exchange_token: tokenRes.data.access_token
        },
        timeout: API_TIMEOUT_MS
    });
    const accessToken = longTokenRes.data.access_token;

    // 3. Name the account after the linked Instagram professional account
    const pagesRes = await axios.get(`${graph}/me/accounts`, {
        params: { fields: 'instagram_business_account{username}', access_token: accessToken },
        timeout: API_TIMEOUT_MS
    });
    const username = (pagesRes.data.data || []).map(p => p.instagram_business_account?.username).find(Boolean);
    if (!username) {
        throw new Error('No Instagram professional account is linked to your Facebook Pages.');
    }
    await saveAccount('instagram', `@${username}`, accessToken, '');
}));

// ---------------------------------------------------------------------------
// Starting a flow
// ---------------------------------------------------------------------------
const starters = {
    youtube: (req, res, returnTo) => {
        res.redirect(getYouTubeOAuthClient().generateAuthUrl({
            access_type: 'offline', // Gets refresh_token
            scope: [
                'https://www.googleapis.com/auth/youtube.upload',
                'https://www.googleapis.com/auth/userinfo.profile'
            ],
            prompt: 'consent', // Forces consent screen to always get a refresh token
            state: createState('youtube', { returnTo })
        }));
    },
    x: (req, res, returnTo) => {
        const { url, codeVerifier, state } = getXClient().generateOAuth2AuthLink(
            `${BASE_URL}/auth/x/callback`,
            { scope: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'] }
        );
        createState('x', { codeVerifier, returnTo }, state);
        res.redirect(url);
    },
    tiktok: (req, res, returnTo) => {
        requireEnv('TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET');
        const params = new URLSearchParams({
            client_key: process.env.TIKTOK_CLIENT_KEY,
            scope: 'video.upload,video.publish,user.info.basic',
            response_type: 'code',
            redirect_uri: `${BASE_URL}/auth/tiktok/callback`,
            state: createState('tiktok', { returnTo })
        });
        res.redirect(`https://www.tiktok.com/v2/auth/authorize/?${params}`);
    },
    instagram: (req, res, returnTo) => {
        requireEnv('INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET');
        const params = new URLSearchParams({
            client_id: process.env.INSTAGRAM_CLIENT_ID,
            redirect_uri: `${BASE_URL}/auth/instagram/callback`,
            scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement',
            state: createState('instagram', { returnTo })
        });
        res.redirect(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params}`);
    },
};

router.get('/:platform', (req, res) => {
    const { platform } = req.params;
    let returnTo = safeReturnTo(req.query.return_to);

    if (!CONNECTABLE_PLATFORMS.includes(platform)) {
        return finishFlow(res, returnTo, { error: 'platform_not_implemented' });
    }

    // With an access token configured, the flow must be started by an authenticated client
    if (tokenRequired()) {
        const ticket = consumeState('ticket', req.query.ticket);
        if (!ticket || ticket.platform !== platform) {
            return finishFlow(res, returnTo, { error: 'unauthorized' });
        }
        returnTo = ticket.returnTo;
    }

    try {
        starters[platform](req, res, returnTo);
    } catch (e) {
        console.error(`${platform} OAuth setup error:`, e.message);
        finishFlow(res, returnTo, { error: 'setup_required' });
    }
});

module.exports = { router, createOAuthTicket };
