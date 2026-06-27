const axios = require('axios');
const fs = require('fs');
const path = require('path');

const uploadToInstagram = async (post, account, tempVideoPath) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Meta Graph API requires the user's IG Account ID. We must fetch it using the access_token.
            // 1. Get Facebook Page -> Instagram Business Account ID
            const pageRes = await axios.get(`https://graph.facebook.com/v17.0/me/accounts?access_token=${account.access_token}`);
            if (!pageRes.data.data || pageRes.data.data.length === 0) {
                return reject(new Error("No Facebook Pages found. You must link an IG Professional account to a FB Page."));
            }
            
            const pageId = pageRes.data.data[0].id; // using first page for simplicity
            
            const igRes = await axios.get(`https://graph.facebook.com/v17.0/${pageId}?fields=instagram_business_account&access_token=${account.access_token}`);
            const igAccountId = igRes.data.instagram_business_account?.id;

            if (!igAccountId) {
                return reject(new Error("No Instagram Business Account linked to this Facebook Page."));
            }

            console.log(`[Instagram] Initializing Reels upload for IG Account: ${igAccountId}`);

            // 2. Initialize the Upload Container
            // Instagram requires the video URL to be publicly accessible, but since we are running locally, 
            // we have to use the official resumable upload method (chunked) instead of passing a URL,
            // OR use a service like ngrok. For this implementation, we assume `post.clip_url` is accessible 
            // by Meta (e.g. if the backend was deployed to the cloud).
            // NOTE: If testing locally, this WILL fail unless clip_url is a public internet URL.
            
            const containerRes = await axios.post(`https://graph.facebook.com/v17.0/${igAccountId}/media`, null, {
                params: {
                    media_type: 'REELS',
                    video_url: post.clip_url, // Must be accessible over the internet
                    caption: `${post.title}\n\n${post.description}\n\n${post.hashtags || ''}`,
                    access_token: account.access_token
                }
            });

            const creationId = containerRes.data.id;
            console.log(`[Instagram] Container created: ${creationId}. Waiting for Meta to process video...`);

            // 3. Wait for Meta to download and process the video
            let status = 'IN_PROGRESS';
            let attempts = 0;
            while (status === 'IN_PROGRESS' && attempts < 15) {
                await new Promise(r => setTimeout(r, 5000)); // wait 5s
                attempts++;
                const statusRes = await axios.get(`https://graph.facebook.com/v17.0/${creationId}?fields=status_code&access_token=${account.access_token}`);
                status = statusRes.data.status_code;
                console.log(`[Instagram] Status: ${status}`);
                
                if (status === 'ERROR') {
                    return reject(new Error("Meta failed to process the video. Ensure clip_url is publicly accessible."));
                }
            }

            if (status !== 'FINISHED') {
                return reject(new Error("Meta video processing timed out."));
            }

            // 4. Publish the Reel
            console.log(`[Instagram] Publishing Reel...`);
            const publishRes = await axios.post(`https://graph.facebook.com/v17.0/${igAccountId}/media_publish`, null, {
                params: {
                    creation_id: creationId,
                    access_token: account.access_token
                }
            });

            console.log(`[Instagram] Upload successful! Post ID: ${publishRes.data.id}`);
            resolve(publishRes.data);

        } catch (error) {
            console.error("[Instagram] API Error:", error.response?.data || error.message);
            reject(error);
        }
    });
};

module.exports = { uploadToInstagram };
