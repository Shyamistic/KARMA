"use strict";
/**
 * Rumble Creator Monitor
 * Fetches public creator metrics from Rumble's public pages
 * Runs on a configurable schedule (default: every 30 minutes)
 *
 * Since Rumble has no public API, we use their public web interface.
 * Rumble pages are publicly accessible — no authentication required.
 *
 * Data collected:
 * - Latest video view counts and upload timestamps
 * - Subscriber counts
 * - Engagement signals (likes, comments)
 * - Livestream status
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchCreatorMetrics = fetchCreatorMetrics;
exports.getMonitoredCreators = getMonitoredCreators;
exports.addCreator = addCreator;
exports.saveMetricsSnapshot = saveMetricsSnapshot;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const database_1 = require("../database");
async function fetchCreatorMetrics(username) {
    try {
        const url = `https://rumble.com/c/${username}`;
        const response = await axios_1.default.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; KarmaBot/1.0)',
                'Accept': 'text/html,application/xhtml+xml',
            },
            timeout: 30000
        });
        const $ = cheerio.load(response.data);
        // Extract creator data from Rumble's public HTML
        // These selectors may need adjustment based on actual Rumble HTML structure
        const displayName = $('h1.channel-header--title').first().text().trim()
            || $('[class*="channel-name"]').first().text().trim()
            || username;
        const subscriberText = $('[class*="subscriber"]').first().text().trim();
        const subscribers = parseCount(subscriberText);
        // Get latest video
        const firstVideo = $('[class*="video-item"], .videostream, article.video').first();
        const latestVideoTitle = firstVideo.find('[class*="title"], h3, h2').first().text().trim();
        const latestVideoUrl = 'https://rumble.com' + (firstVideo.find('a').first().attr('href') || '');
        const latestVideoAgeText = firstVideo.find('[class*="time"], time, [datetime]').first().text().trim();
        const latestVideoViewsText = firstVideo.find('[class*="views"], [class*="count"]').first().text().trim();
        const latestVideoViews = parseCount(latestVideoViewsText);
        // Estimate view velocity from age + view count
        const hoursOld = parseHoursOld(latestVideoAgeText);
        const viewVelocity = hoursOld > 0 ? Math.round(latestVideoViews / hoursOld) : 0;
        const isLive = $('[class*="live"], .livestream-badge').length > 0;
        const totalVideosText = $('[class*="video-count"]').first().text().trim();
        const totalVideos = parseCount(totalVideosText) || 0;
        // Consistency: check how many videos posted recently
        const recentVideos = $('[class*="video-item"]').length;
        const consistencyScore = Math.min(100, recentVideos * 10);
        // Engagement from available signals
        const likesText = firstVideo.find('[class*="like"], [class*="vote"]').first().text().trim();
        const likes = parseCount(likesText);
        const commentsText = firstVideo.find('[class*="comment"]').first().text().trim();
        const comments = parseCount(commentsText);
        const engagementRate = latestVideoViews > 0
            ? ((likes + comments) / latestVideoViews) * 100
            : 0;
        return {
            username,
            displayName: displayName || username,
            subscribers,
            latestVideoViews,
            latestVideoTitle,
            latestVideoUrl,
            latestVideoAge: latestVideoAgeText,
            viewVelocity,
            isLive,
            totalVideos,
            engagementRate: parseFloat(engagementRate.toFixed(2)),
            consistencyScore,
            lastChecked: new Date().toISOString()
        };
    }
    catch (err) {
        console.error(`[Rumble] Failed to fetch metrics for ${username}:`, err);
        return null;
    }
}
async function getMonitoredCreators() {
    const db = await (0, database_1.getDatabase)();
    const rows = await db.all('SELECT username FROM rumble_creators WHERE active = 1');
    return rows.map(r => r.username);
}
async function addCreator(username, walletAddress) {
    const db = await (0, database_1.getDatabase)();
    await db.run(`
    INSERT OR REPLACE INTO rumble_creators (username, wallet_address, active, added_at)
    VALUES (?, ?, 1, datetime('now'))
  `, username, walletAddress || null);
}
async function saveMetricsSnapshot(metrics) {
    const db = await (0, database_1.getDatabase)();
    await db.run(`
    INSERT OR REPLACE INTO rumble_metrics
    (username, subscribers, latest_views, view_velocity, is_live,
     engagement_rate, consistency_score, latest_video_title,
     latest_video_url, checked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `, metrics.username, metrics.subscribers, metrics.latestVideoViews, metrics.viewVelocity, metrics.isLive ? 1 : 0, metrics.engagementRate, metrics.consistencyScore, metrics.latestVideoTitle, metrics.latestVideoUrl);
}
// Parse "1.2M", "45K", "1,234" etc into numbers
function parseCount(text) {
    if (!text)
        return 0;
    const clean = text.replace(/[^0-9.KMBkmb]/g, '').trim();
    if (clean.toLowerCase().endsWith('k'))
        return Math.round(parseFloat(clean) * 1000);
    if (clean.toLowerCase().endsWith('m'))
        return Math.round(parseFloat(clean) * 1000000);
    if (clean.toLowerCase().endsWith('b'))
        return Math.round(parseFloat(clean) * 1000000000);
    return parseInt(clean.replace(/,/g, '')) || 0;
}
// Parse "2 hours ago", "1 day ago", "30 minutes ago" into hours
function parseHoursOld(text) {
    if (!text)
        return 24;
    const t = text.toLowerCase();
    if (t.includes('minute'))
        return 1;
    if (t.includes('hour')) {
        const n = parseInt(t.match(/(\d+)/)?.[1] || '1');
        return n;
    }
    if (t.includes('day')) {
        const n = parseInt(t.match(/(\d+)/)?.[1] || '1');
        return n * 24;
    }
    if (t.includes('week'))
        return 168;
    return 24;
}
