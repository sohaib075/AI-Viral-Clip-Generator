const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const API_TIMEOUT_MS = 60 * 1000;
const UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;
const STATUS_POLL_INTERVAL_MS = 10000;
const STATUS_POLL_ATTEMPTS = 30; // Up to 5 minutes; Meta can be slow to process Reels

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const graphError = (err, fallback) => {
    const apiError = err.response?.data?.error;
    return apiError?.message ? `${fallback}: ${apiError.message}` : `${fallback}: ${err.message}`;
};

// Finds the Instagram professional account to post to. Accounts are saved as "@username",
// so with several linked accounts the one that was connected is used.
const findInstagramAccountId = async (account) => {
    const pagesRes = await axios.get(`${GRAPH_URL}/me/accounts`, {
        params: { fields: 'instagram_business_account{id,username}', access_token: account.access_token },
        timeout: API_TIMEOUT_MS
    });
    const igAccounts = (pagesRes.data.data || []).map(page => page.instagram_business_account).filter(Boolean);
    if (igAccounts.length === 0) {
        throw Object.assign(new Error("No Instagram professional account is linked to your Facebook Pages."), { retryable: false });
    }
    const wanted = (account.account_name || '').replace(/^@/, '');
    return (igAccounts.find(ig => ig.username === wanted) || igAccounts[0]).id;
};

const uploadToInstagram = async (post, account, tempVideoPath) => {
    const accessToken = account.access_token;

    let igAccountId;
    try {
        igAccountId = await findInstagramAccountId(account);
    } catch (err) {
        if (err.retryable === false) throw err;
        throw new Error(graphError(err, 'Could not load your Instagram account'));
    }

    console.log(`[Instagram] Initializing Reels upload for IG Account: ${igAccountId}`);

    // 1. Create a resumable upload container. The video bytes are sent to Meta directly,
    //    so the clip doesn't need to be reachable from the internet.
    const caption = [post.title, post.description, post.hashtags].filter(Boolean).join('\n\n').slice(0, 2200);
    let creationId;
    let uploadUri;
    try {
        const containerRes = await axios.post(`${GRAPH_URL}/${igAccountId}/media`, null, {
            params: { media_type: 'REELS', upload_type: 'resumable', caption, access_token: accessToken },
            timeout: API_TIMEOUT_MS
        });
        creationId = containerRes.data.id;
        uploadUri = containerRes.data.uri || `https://rupload.facebook.com/ig-api-upload/${GRAPH_VERSION}/${creationId}`;
    } catch (err) {
        throw new Error(graphError(err, 'Instagram rejected the upload'));
    }

    // 2. Upload the local file
    console.log(`[Instagram] Container created: ${creationId}. Uploading video...`);
    const fileSize = fs.statSync(tempVideoPath).size;
    try {
        const uploadRes = await axios.post(uploadUri, fs.createReadStream(tempVideoPath), {
            headers: {
                Authorization: `OAuth ${accessToken}`,
                offset: '0',
                file_size: String(fileSize),
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileSize
            },
            maxBodyLength: Infinity,
            timeout: UPLOAD_TIMEOUT_MS
        });
        if (uploadRes.data?.success === false) {
            throw new Error(uploadRes.data.message || 'unknown error');
        }
    } catch (err) {
        throw new Error(graphError(err, 'Uploading the video to Instagram failed'));
    }

    // 3. Wait for Meta to process the video (nothing is published until step 4)
    let status = 'IN_PROGRESS';
    for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS && status === 'IN_PROGRESS'; attempt++) {
        await sleep(STATUS_POLL_INTERVAL_MS);
        let statusRes;
        try {
            statusRes = await axios.get(`${GRAPH_URL}/${creationId}`, {
                params: { fields: 'status_code,status', access_token: accessToken },
                timeout: API_TIMEOUT_MS
            });
        } catch (err) {
            console.error('[Instagram] Status check failed:', graphError(err, 'status'));
            continue;
        }
        status = statusRes.data.status_code;
        console.log(`[Instagram] Status: ${status}`);

        if (status === 'ERROR' || status === 'EXPIRED') {
            throw new Error(`Meta failed to process the video (${status}): ${statusRes.data.status || 'no details'}`);
        }
    }

    if (status !== 'FINISHED') {
        throw new Error("Meta video processing timed out.");
    }

    // 4. Publish the Reel
    console.log(`[Instagram] Publishing Reel...`);
    try {
        const publishRes = await axios.post(`${GRAPH_URL}/${igAccountId}/media_publish`, null, {
            params: { creation_id: creationId, access_token: accessToken },
            timeout: API_TIMEOUT_MS
        });
        console.log(`[Instagram] Upload successful! Post ID: ${publishRes.data.id}`);
        return publishRes.data;
    } catch (err) {
        const error = new Error(graphError(err, 'Publishing the Reel failed'));
        // Without a response we can't tell whether Meta published it
        if (!err.response) error.mayHavePublished = true;
        throw error;
    }
};

module.exports = { uploadToInstagram, GRAPH_VERSION };
