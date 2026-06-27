const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'scheduler.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Accounts Table
    db.run(`
        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            platform TEXT NOT NULL,
            account_name TEXT,
            access_token TEXT,
            refresh_token TEXT,
            status TEXT DEFAULT 'connected',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Posts (Queue) Table
    db.run(`
        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            clip_url TEXT NOT NULL,
            platforms TEXT NOT NULL,
            title TEXT,
            description TEXT,
            hashtags TEXT,
            scheduled_time DATETIME NOT NULL,
            status TEXT DEFAULT 'pending',
            retry_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            error_message TEXT
        )
    `);

    // Uploaded Videos (Global Duplicate Prevention) Table
    db.run(`
        CREATE TABLE IF NOT EXISTS uploaded_videos (
            video_hash TEXT PRIMARY KEY,
            platform TEXT NOT NULL,
            upload_status TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

module.exports = db;
