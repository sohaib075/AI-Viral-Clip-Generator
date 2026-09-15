const crypto = require('crypto');
require('dotenv').config();

const KEY_PATTERN = /^[0-9a-fA-F]{64}$/; // 32 bytes for AES-256
const GCM_PREFIX = 'gcm:';

// Tokens must be encrypted with a stable key. Falling back to a random key would make every
// stored token unreadable after a restart, so encryption fails loudly until the key is set.
function getKey() {
    const key = process.env.ENCRYPTION_KEY || '';
    if (!KEY_PATTERN.test(key)) {
        throw new Error(
            'ENCRYPTION_KEY must be set to 64 hex characters. Generate one with: ' +
            `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
        );
    }
    return Buffer.from(key, 'hex');
}

if (!KEY_PATTERN.test(process.env.ENCRYPTION_KEY || '')) {
    console.warn('[Crypto] ENCRYPTION_KEY is missing or invalid. Connecting and publishing to social accounts will fail until it is set.');
}

// AES-256-GCM, which also detects tampering: "gcm:<iv>:<tag>:<ciphertext>" (hex)
function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return `${GCM_PREFIX}${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(text) {
    if (!text) return text;
    const key = getKey(); // A missing key is a configuration error, not a bad token
    try {
        if (text.startsWith(GCM_PREFIX)) {
            const [ivHex, tagHex, dataHex] = text.slice(GCM_PREFIX.length).split(':');
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
            decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
            return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
        }

        // Tokens saved by older versions: AES-256-CBC "<iv>:<ciphertext>" (re-encrypted with GCM when next saved)
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        return Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString();
    } catch (e) {
        console.error("Decryption failed:", e.message);
        return null;
    }
}

module.exports = { encrypt, decrypt };
