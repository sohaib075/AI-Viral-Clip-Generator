const net = require('net');
const { createHash, timingSafeEqual } = require('crypto');
require('dotenv').config();

const toUrl = (value) => {
    try {
        return new URL(String(value).trim());
    } catch {
        return null;
    }
};

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

// ---------------------------------------------------------------------------
// Origins: browsers may only call the API from the web UI. Localhost origins are always allowed;
// add others with ALLOWED_ORIGINS or FRONTEND_URL. Requests without an Origin header (the mobile
// app, OAuth redirects, curl) are not affected.
// ---------------------------------------------------------------------------
const configuredOriginUrls = [...(process.env.ALLOWED_ORIGINS || '').split(','), process.env.FRONTEND_URL]
    .filter(Boolean)
    .map(toUrl)
    .filter(Boolean);
const allowedOrigins = new Set(configuredOriginUrls.map(u => u.origin));

const isAllowedOrigin = (origin) => {
    if (allowedOrigins.has(origin)) return true;
    const url = toUrl(origin);
    return Boolean(url) && LOCAL_HOSTNAMES.has(url.hostname);
};

// ---------------------------------------------------------------------------
// Hosts: a hostile domain re-pointed at this machine (DNS rebinding) arrives with its own Host
// header. IP addresses can't be rebound, so any IP is fine; names must be known.
// ---------------------------------------------------------------------------
const allowedHostnames = new Set([
    ...LOCAL_HOSTNAMES,
    'backend', // docker-compose service name
    ...(process.env.ALLOWED_HOSTS || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean),
    ...[process.env.BASE_URL, ...configuredOriginUrls].map(toUrl).filter(Boolean).map(u => u.hostname),
]);

const isAllowedHost = (hostHeader) => {
    const url = hostHeader ? toUrl(`http://${hostHeader}`) : null;
    if (!url) return false;
    const hostname = url.hostname.toLowerCase();
    return allowedHostnames.has(hostname) || net.isIP(hostname.replace(/^\[|\]$/g, '')) !== 0;
};

// ---------------------------------------------------------------------------
// Optional access token: when API_TOKEN is set, API requests must send `Authorization: Bearer <token>`.
// ---------------------------------------------------------------------------
const API_TOKEN = process.env.API_TOKEN || '';
const digest = (value) => createHash('sha256').update(value).digest();

const tokenRequired = () => Boolean(API_TOKEN);

const isAuthorized = (req) => {
    if (!API_TOKEN) return true;
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return false;
    return timingSafeEqual(digest(header.slice('Bearer '.length)), digest(API_TOKEN));
};

const requireToken = (req, res, next) => {
    if (isAuthorized(req)) return next();
    res.status(401).json({ error: 'A valid access token is required.', tokenRequired: true });
};

module.exports = { isAllowedOrigin, isAllowedHost, tokenRequired, isAuthorized, requireToken };
