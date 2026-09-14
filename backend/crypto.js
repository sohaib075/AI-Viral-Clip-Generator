const crypto = require('crypto');
require('dotenv').config();

const IV_LENGTH = 16; // For AES, this is always 16
const KEY_PATTERN = /^[0-9a-fA-F]{64}$/; // 32 bytes for AES-256

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

function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return text;
    const key = getKey(); // A missing key is a configuration error, not a bad token
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        console.error("Decryption failed:", e.message);
        return null;
    }
}

module.exports = { encrypt, decrypt };
