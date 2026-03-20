"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = getDatabase;
exports.saveTip = saveTip;
exports.getRecentTips = getRecentTips;
exports.getAggregateStats = getAggregateStats;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
let db = null;
async function getDatabase() {
    if (!db) {
        db = await (0, sqlite_1.open)({
            filename: path_1.default.join(process.cwd(), 'karma.db'),
            driver: sqlite3_1.default.Database
        });
        await initSchema(db);
    }
    return db;
}
async function initSchema(db) {
    await db.exec(`
    -- GitHub tips
    CREATE TABLE IF NOT EXISTS tips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_number INTEGER,
      pr_title TEXT,
      pr_url TEXT,
      repo_name TEXT,
      contributor TEXT,
      score_technical INTEGER DEFAULT 0,
      score_impact INTEGER DEFAULT 0,
      score_effort INTEGER DEFAULT 0,
      score_community INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0,
      tier TEXT,
      amount_usdt REAL DEFAULT 0,
      reasoning TEXT,
      claim_token TEXT,
      tx_hash TEXT,
      tipped INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Claimable links (GitHub + Rumble)
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      claim_token TEXT UNIQUE NOT NULL,
      contributor TEXT NOT NULL,
      amount_usdt REAL NOT NULL,
      pr_url TEXT,
      pr_title TEXT,
      repo_name TEXT,
      tier TEXT,
      reasoning TEXT,
      total_score INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      claimed INTEGER DEFAULT 0,
      claimed_by TEXT,
      tx_hash TEXT,
      claimed_at TEXT,
      platform TEXT DEFAULT 'github'
    );

    -- Rumble creator registry
    CREATE TABLE IF NOT EXISTS rumble_creators (
      username TEXT PRIMARY KEY,
      wallet_address TEXT,
      active INTEGER DEFAULT 1,
      added_at TEXT DEFAULT (datetime('now')),
      notes TEXT
    );

    -- Rumble metrics history
    CREATE TABLE IF NOT EXISTS rumble_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      subscribers INTEGER DEFAULT 0,
      latest_views INTEGER DEFAULT 0,
      view_velocity INTEGER DEFAULT 0,
      is_live INTEGER DEFAULT 0,
      engagement_rate REAL DEFAULT 0,
      consistency_score INTEGER DEFAULT 0,
      latest_video_title TEXT,
      latest_video_url TEXT,
      checked_at TEXT DEFAULT (datetime('now'))
    );

    -- Rumble tips log
    CREATE TABLE IF NOT EXISTS rumble_tips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      display_name TEXT,
      video_title TEXT,
      video_url TEXT,
      wallet_address TEXT,
      amount_usdt REAL DEFAULT 0,
      tier TEXT,
      total_score INTEGER DEFAULT 0,
      reasoning TEXT,
      claim_token TEXT,
      tx_hash TEXT,
      tipped INTEGER DEFAULT 0,
      tip_type TEXT DEFAULT 'direct', -- 'direct', 'milestone', 'manual'
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Rumble milestone tracking
    CREATE TABLE IF NOT EXISTS rumble_milestones (
      username TEXT,
      milestone_key TEXT,
      rewarded_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (username, milestone_key)
    );

    CREATE INDEX IF NOT EXISTS idx_tips_contributor ON tips(contributor);
    CREATE INDEX IF NOT EXISTS idx_rumble_tips_username ON rumble_tips(username);
    CREATE INDEX IF NOT EXISTS idx_claims_token ON claims(claim_token);
  `);
}
async function saveTip(data) {
    const db = await getDatabase();
    await db.run(`
    INSERT INTO tips (
      pr_number, pr_title, pr_url, repo_name, contributor,
      score_technical, score_impact, score_effort, score_community, total_score,
      tier, amount_usdt, reasoning, claim_token
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, data.prNumber, data.prTitle, data.prUrl, data.repoName, data.contributor, data.scores?.technical || 0, data.scores?.impact || 0, data.scores?.effort || 0, data.scores?.community || 0, data.totalScore, data.tier, data.amountUsdt, data.reasoning, data.claimToken || '');
}
async function getRecentTips(limit = 20) {
    const db = await getDatabase();
    return db.all('SELECT * FROM tips ORDER BY id DESC LIMIT ?', limit);
}
async function getAggregateStats() {
    const db = await getDatabase();
    const today = new Date().toISOString().split('T')[0];
    const gh = (await db.get(`
    SELECT COUNT(*) as c, COALESCE(SUM(amount_usdt),0) as u
    FROM tips WHERE tipped = 1
  `));
    const ghToday = (await db.get(`
    SELECT COUNT(*) as c, COALESCE(SUM(amount_usdt),0) as u
    FROM tips WHERE tipped = 1 AND created_at LIKE ?
  `, `${today}%`));
    const rm = (await db.get(`
    SELECT COUNT(*) as c, COALESCE(SUM(amount_usdt),0) as u
    FROM rumble_tips WHERE tipped = 1
  `));
    const rmToday = (await db.get(`
    SELECT COUNT(*) as c, COALESCE(SUM(amount_usdt),0) as u
    FROM rumble_tips WHERE tipped = 1 AND created_at LIKE ?
  `, `${today}%`));
    const pending = (await db.get(`
    SELECT COUNT(*) as c, COALESCE(SUM(amount_usdt),0) as u
    FROM claims WHERE claimed = 0 AND expires_at > datetime('now')
  `));
    return {
        github: { totalTips: gh?.c || 0, totalUsdt: gh?.u || 0, tipsToday: ghToday?.c || 0 },
        rumble: { totalTips: rm?.c || 0, totalUsdt: rm?.u || 0, tipsToday: rmToday?.c || 0 },
        pool: { pendingClaims: pending?.c || 0, pendingUsdt: pending?.u || 0 }
    };
}
