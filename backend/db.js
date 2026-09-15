const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'scheduler.db');
const db = new sqlite3.Database(dbPath);

// Promise wrappers around the callback-based sqlite3 API
db.runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});
db.getAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});
db.allAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

// Uploaded Videos (Global Duplicate Prevention) Table
// One row per video per platform, so a clip can go to several platforms but never twice to the same one.
const UPLOADED_VIDEOS_SCHEMA = `
    CREATE TABLE IF NOT EXISTS uploaded_videos (
        video_hash TEXT NOT NULL,
        platform TEXT NOT NULL,
        upload_status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (video_hash, platform)
    )
`;

const init = async () => {
    // Accounts Table
    await db.runAsync(`
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
    // scheduled_time is stored in UTC ('YYYY-MM-DD HH:MM:SS')
    // platform_results is a JSON map of platform -> 'uploaded' | { error, retryable }
    await db.runAsync(`
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
            error_message TEXT,
            platform_results TEXT
        )
    `);

    await db.runAsync(UPLOADED_VIDEOS_SCHEMA);

    // Migration: posts.platform_results was added later
    const postColumns = await db.allAsync(`PRAGMA table_info(posts)`);
    if (!postColumns.some(c => c.name === 'platform_results')) {
        await db.runAsync(`ALTER TABLE posts ADD COLUMN platform_results TEXT`);
    }

    // Migration: uploaded_videos used to be keyed on video_hash alone, which blocked
    // posting the same clip to a second platform
    const videoColumns = await db.allAsync(`PRAGMA table_info(uploaded_videos)`);
    const platformColumn = videoColumns.find(c => c.name === 'platform');
    if (platformColumn && platformColumn.pk === 0) {
        await db.runAsync('BEGIN TRANSACTION');
        try {
            await db.runAsync('ALTER TABLE uploaded_videos RENAME TO uploaded_videos_old');
            await db.runAsync(UPLOADED_VIDEOS_SCHEMA);
            await db.runAsync(`
                INSERT OR IGNORE INTO uploaded_videos (video_hash, platform, upload_status, created_at)
                SELECT video_hash, platform, upload_status, created_at FROM uploaded_videos_old
            `);
            await db.runAsync('DROP TABLE uploaded_videos_old');
            await db.runAsync('COMMIT');
            console.log('[DB] Migrated uploaded_videos to a per-platform key.');
        } catch (err) {
            await db.runAsync('ROLLBACK');
            throw err;
        }
    }
};

// Resolves once tables and migrations are in place. Rejects on failure so callers
// (queue worker / server boot) can refuse to start against a broken database.
db.ready = init();

module.exports = db;
