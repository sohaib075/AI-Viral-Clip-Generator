const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const db = require('./db');
const { encrypt } = require('./crypto');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const YOUTUBE_REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI || `${BASE_URL}/auth/youtube/callback`;

function getYouTubeOAuthClient(redirectUri) {
    if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
        throw new Error('Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET');
    }

    return new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        redirectUri
    );
}

// ==========================================
// YOUTUBE (Google) OAUTH
// ==========================================
router.get('/youtube', (req, res) => {
    try {
        const oauth2Client = getYouTubeOAuthClient(YOUTUBE_REDIRECT_URI);
        const scopes = [
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/userinfo.profile'
        ];
        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline', // Gets refresh_token
            scope: scopes,
            prompt: 'consent' // Forces consent screen to always get a refresh token
        });
        res.redirect(url);
    } catch (e) {
        console.error('YouTube OAuth setup error:', e.message);
        res.redirect(`${FRONTEND_URL}/accounts?error=setup_required`);
    }
});

router.get('/youtube/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const oauth2Client = getYouTubeOAuthClient(YOUTUBE_REDIRECT_URI);
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Fetch user profile to get account name
        const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
        const userInfo = await oauth2.userinfo.get();
        const accountName = userInfo.data.name || 'YouTube Account';

        const id = `acc_yt_${Date.now()}`;
        db.run(`INSERT INTO accounts (id, platform, account_name, access_token, refresh_token) VALUES (?, ?, ?, ?, ?)`,
            [id, 'youtube', accountName, encrypt(tokens.access_token), encrypt(tokens.refresh_token || '')], (err) => {
                if (err) console.error("DB Error:", err);
                res.redirect(`${FRONTEND_URL}/accounts`);
            });
    } catch (e) {
        console.error("YouTube OAuth Error:", e);
        res.redirect(`${FRONTEND_URL}/accounts?error=oauth_failed`);
    }
});


// ==========================================
// X (Twitter) OAUTH 2.0
// ==========================================
// Note: Twitter API v2 requires OAuth 2.0 PKCE flow. 
// For simplicity in this local server, we store the state and codeVerifier in memory temporarily.
const twitterClients = {}; 

router.get('/x', (req, res) => {
    try {
        const client = new TwitterApi({
            clientId: process.env.X_CLIENT_ID,
            clientSecret: process.env.X_CLIENT_SECRET,
        });

        const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
            `${BASE_URL}/auth/x/callback`,
            { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] }
        );
        
        twitterClients[state] = codeVerifier;
        res.redirect(url);
    } catch (e) {
        console.error("X OAuth Error:", e);
        res.redirect(`${FRONTEND_URL}/accounts?error=setup_required`);
    }
});

router.get('/x/callback', async (req, res) => {
    const { state, code } = req.query;
    const codeVerifier = twitterClients[state];

    if (!codeVerifier || !state || !code) {
        return res.redirect(`${FRONTEND_URL}/accounts?error=invalid_session`);
    }

    try {
        const client = new TwitterApi({
            clientId: process.env.X_CLIENT_ID,
            clientSecret: process.env.X_CLIENT_SECRET,
        });

        const { client: loggedClient, accessToken, refreshToken } = await client.loginWithOAuth2({
            code,
            codeVerifier,
            redirectUri: `${BASE_URL}/auth/x/callback`,
        });

        const user = await loggedClient.v2.me();
        const accountName = `@${user.data.username}`;

        const id = `acc_x_${Date.now()}`;
        db.run(`INSERT INTO accounts (id, platform, account_name, access_token, refresh_token) VALUES (?, ?, ?, ?, ?)`,
            [id, 'x', accountName, encrypt(accessToken), encrypt(refreshToken || '')], (err) => {
                if (err) console.error("DB Error:", err);
                delete twitterClients[state];
                res.redirect(`${FRONTEND_URL}/accounts`);
            });
    } catch (e) {
        console.error("X OAuth Callback Error:", e);
        res.redirect(`${FRONTEND_URL}/accounts?error=oauth_failed`);
    }
});

// ==========================================
// TIKTOK OAUTH
// ==========================================
// Note: TikTok requires CSRF state verification
const tiktokStates = new Set();

router.get('/tiktok', (req, res) => {
    const state = Math.random().toString(36).substring(7);
    tiktokStates.add(state);
    
    let url = 'https://www.tiktok.com/v2/auth/authorize/';
    url += `?client_key=${process.env.TIKTOK_CLIENT_KEY}`;
    url += '&scope=video.upload,user.info.basic';
    url += '&response_type=code';
    url += `&redirect_uri=${encodeURIComponent(`${BASE_URL}/auth/tiktok/callback`)}`;
    url += `&state=${state}`;
    
    res.redirect(url);
});

router.get('/tiktok/callback', async (req, res) => {
    const { code, state } = req.query;
    
    if (!tiktokStates.has(state)) {
        return res.redirect(`${FRONTEND_URL}/accounts?error=invalid_state`);
    }
    tiktokStates.delete(state);

    try {
        // Exchange code for access token
        const tokenRes = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', new URLSearchParams({
            client_key: process.env.TIKTOK_CLIENT_KEY,
            client_secret: process.env.TIKTOK_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: `${BASE_URL}/auth/tiktok/callback`
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const { access_token, refresh_token, open_id } = tokenRes.data;

        const id = `acc_tt_${Date.now()}`;
        db.run(`INSERT INTO accounts (id, platform, account_name, access_token, refresh_token) VALUES (?, ?, ?, ?, ?)`,
            [id, 'tiktok', `TikTok User`, encrypt(access_token), encrypt(refresh_token || '')], (err) => {
                if (err) console.error("DB Error:", err);
                res.redirect(`${FRONTEND_URL}/accounts`);
            });
    } catch (e) {
        console.error("TikTok OAuth Callback Error:", e.response?.data || e.message);
        res.redirect(`${FRONTEND_URL}/accounts?error=oauth_failed`);
    }
});

// ==========================================
// INSTAGRAM (Meta Graph API) OAUTH
// ==========================================
router.get('/instagram', (req, res) => {
    const url = `https://www.facebook.com/v17.0/dialog/oauth?client_id=${process.env.INSTAGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${BASE_URL}/auth/instagram/callback`)}&scope=instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement`;
    res.redirect(url);
});

router.get('/instagram/callback', async (req, res) => {
    const { code } = req.query;
    
    try {
        // 1. Exchange code for short-lived access token
        const tokenRes = await axios.get(`https://graph.facebook.com/v17.0/oauth/access_token?client_id=${process.env.INSTAGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${BASE_URL}/auth/instagram/callback`)}&client_secret=${process.env.INSTAGRAM_CLIENT_SECRET}&code=${code}`);
        const shortAccessToken = tokenRes.data.access_token;

        // 2. Exchange for long-lived access token
        const longTokenRes = await axios.get(`https://graph.facebook.com/v17.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.INSTAGRAM_CLIENT_ID}&client_secret=${process.env.INSTAGRAM_CLIENT_SECRET}&fb_exchange_token=${shortAccessToken}`);
        const longAccessToken = longTokenRes.data.access_token;

        const id = `acc_ig_${Date.now()}`;
        db.run(`INSERT INTO accounts (id, platform, account_name, access_token, refresh_token) VALUES (?, ?, ?, ?, ?)`,
            [id, 'instagram', `Instagram Linked`, encrypt(longAccessToken), encrypt('')], (err) => {
                if (err) console.error("DB Error:", err);
                res.redirect(`${FRONTEND_URL}/accounts`);
            });
    } catch (e) {
        console.error("Instagram OAuth Callback Error:", e.response?.data || e.message);
        res.redirect(`${FRONTEND_URL}/accounts?error=oauth_failed`);
    }
});

// Generic placeholder for other platforms
router.get('/:platform', (req, res) => {
    // If not implemented yet, just redirect back with error
    res.redirect(`${FRONTEND_URL}/accounts?error=platform_not_implemented`);
});

module.exports = router;
