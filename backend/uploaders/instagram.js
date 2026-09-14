const axios = require('axios');
const fs = require('fs');

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const STATUS_POLL_INTERVAL_MS = 10000;
const STATUS_POLL_ATTEMPTS = 30; // Up to 5 minutes; Meta can be slow to process Reels

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const uploadToInstagram = async (post, account, tempVideoPath) => {
    const accessToken = account.access_token;

    try {
        // Meta Graph API requires the user's IG Account ID. We must fetch it using the access_token.
        // 1. Get Facebook Page -> Instagram Business Account ID
        const pageRes = await axios.get(`${GRAPH_URL}/me/accounts`, { params: { access_token: accessToken } });
        if (!pageRes.data.data || pageRes.data.data.length === 0) {
            throw new Error("No Facebook Pages found. You must link an IG Professional account to a FB Page.");
        }

        const pageId = pageRes.data.data[0].id; // using first page for simplicity

        const igRes = await axios.get(`${GRAPH_URL}/${pageId}`, {
            params: { fields: 'instagram_business_account', access_token: accessToken }
        });
        const igAccountId = igRes.data.instagram_business_account?.id;

        if (!igAccountId) {
            throw new Error("No Instagram Business Account linked to this Facebook Page.");
        }

        console.log(`[Instagram] Initializing Reels upload for IG Account: ${igAccountId}`);

        // 2. Create a resumable upload container. The video bytes are sent to Meta directly,
        //    so the clip doesn't need to be reachable from the internet.
        const caption = [post.title, post.description, post.hashtags].filter(Boolean).join('\n\n');
        const containerRes = await axios.post(`${GRAPH_URL}/${igAccountId}/media`, null, {
            params: {
                media_type: 'REELS',
                upload_type: 'resumable',
                caption,
                access_token: accessToken
            }
        });

        const creationId = containerRes.data.id;
        const uploadUri = containerRes.data.uri || `https://rupload.facebook.com/ig-api-upload/${GRAPH_VERSION}/${creationId}`;

        // 3. Upload the local file
        console.log(`[Instagram] Container created: ${creationId}. Uploading video...`);
        const fileSize = fs.statSync(tempVideoPath).size;
        const uploadRes = await axios.post(uploadUri, fs.createReadStream(tempVideoPath), {
            headers: {
                Authorization: `OAuth ${accessToken}`,
                offset: '0',
                file_size: String(fileSize),
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileSize
            },
            maxBodyLength: Infinity
        });
        if (uploadRes.data?.success === false) {
            throw new Error(`Instagram upload failed: ${uploadRes.data.message || 'unknown error'}`);
        }

        // 4. Wait for Meta to process the video
        let status = 'IN_PROGRESS';
        for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS && status === 'IN_PROGRESS'; attempt++) {
            await sleep(STATUS_POLL_INTERVAL_MS);
            const statusRes = await axios.get(`${GRAPH_URL}/${creationId}`, {
                params: { fields: 'status_code,status', access_token: accessToken }
            });
            status = statusRes.data.status_code;
            console.log(`[Instagram] Status: ${status}`);

            if (status === 'ERROR' || status === 'EXPIRED') {
                throw new Error(`Meta failed to process the video (${status}): ${statusRes.data.status || 'no details'}`);
            }
        }

        if (status !== 'FINISHED') {
            throw new Error("Meta video processing timed out.");
        }

        // 5. Publish the Reel
        console.log(`[Instagram] Publishing Reel...`);
        const publishRes = await axios.post(`${GRAPH_URL}/${igAccountId}/media_publish`, null, {
            params: {
                creation_id: creationId,
                access_token: accessToken
            }
        });

        console.log(`[Instagram] Upload successful! Post ID: ${publishRes.data.id}`);
        return publishRes.data;
    } catch (error) {
        console.error("[Instagram] API Error:", error.response?.data || error.message);
        throw error;
    }
};

module.exports = { uploadToInstagram, GRAPH_VERSION };
