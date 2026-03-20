"use strict";
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
const htmx_extractor_1 = require("./htmx-extractor");
const db_1 = require("../../lib/db");
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
        const displayName = $('h1.channel-header--title').first().text().trim()
            || $('[class*="channel-name"]').first().text().trim()
            || username;
        const subscriberText = $('[class*="subscriber"]').first().text().trim();
        const subscribers = parseCount(subscriberText);
        const firstVideo = $('[class*="video-item"], .videostream, article.video').first();
        const latestVideoTitle = firstVideo.find('[class*="title"], h3, h2').first().text().trim();
        const latestVideoUrl = 'https://rumble.com' + (firstVideo.find('a').first().attr('href') || '');
        const latestVideoAgeText = firstVideo.find('[class*="time"], time, [datetime]').first().text().trim();
        const latestVideoViewsText = firstVideo.find('[class*="views"], [class*="count"]').first().text().trim();
        const latestVideoViews = parseCount(latestVideoViewsText);
        const hoursOld = parseHoursOld(latestVideoAgeText);
        const viewVelocity = hoursOld > 0 ? Math.round(latestVideoViews / hoursOld) : 0;
        const isLive = $('[class*="live"], .livestream-badge').length > 0;
        const totalVideosText = $('[class*="video-count"]').first().text().trim();
        const totalVideos = parseCount(totalVideosText) || 0;
        const recentVideos = $('[class*="video-item"]').length;
        const consistencyScore = Math.min(100, recentVideos * 10);
        const likesText = firstVideo.find('[class*="like"], [class*="vote"]').first().text().trim();
        const likes = parseCount(likesText);
        const commentsText = firstVideo.find('[class*="comment"]').first().text().trim();
        const comments = parseCount(commentsText);
        const engagementRate = latestVideoViews > 0
            ? ((likes + comments) / latestVideoViews) * 100
            : 0;
        const metrics = {
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
        // Try to extract native wallet via HTMX to prevent needing claim links
        const walletAddress = await (0, htmx_extractor_1.extractCreatorWallet)(username) || undefined;
        if (walletAddress) {
            metrics.walletAddress = walletAddress;
            // Persist the discovered wallet to the registry immediately
            try {
                await (0, db_1.addCreator)(username, walletAddress);
            }
            catch (e) {
                console.error(`[Rumble] Failed to save extracted wallet for ${username}`, e);
            }
        }
        return metrics;
    }
    catch (err) {
        console.error(`[Rumble] Failed to fetch metrics for @${username}: ${err.message || 'Unknown Error'}`);
        return null;
    }
}
async function getMonitoredCreators() {
    return (0, db_1.getMonitoredCreators)();
}
async function addCreator(username, walletAddress) {
    await (0, db_1.addCreator)(username, walletAddress);
}
async function saveMetricsSnapshot(metrics) {
    await (0, db_1.saveMetricsSnapshot)(metrics);
}
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
