"use strict";
/**
 * Runs the Rumble monitoring loop on a schedule
 * Default: every 30 minutes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRumbleScheduler = startRumbleScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const monitor_1 = require("./monitor");
const evaluator_1 = require("./evaluator");
const tipper_1 = require("./tipper");
const database_1 = require("../database");
function startRumbleScheduler() {
    // Run every 30 minutes
    node_cron_1.default.schedule('*/30 * * * *', async () => {
        await runRumbleCheck();
    });
    // Run immediately on startup
    setTimeout(runRumbleCheck, 5000);
    console.log('[Rumble] Scheduler started — checking every 30 minutes');
}
async function runRumbleCheck() {
    const creators = await (0, monitor_1.getMonitoredCreators)();
    if (!creators.length) {
        console.log('[Rumble] No creators configured to monitor');
        return;
    }
    console.log(`[Rumble] Checking ${creators.length} creators...`);
    for (const username of creators) {
        try {
            // Fetch public metrics
            const metrics = await (0, monitor_1.fetchCreatorMetrics)(username);
            if (!metrics)
                continue;
            // Save snapshot for history
            await (0, monitor_1.saveMetricsSnapshot)(metrics);
            // Check if already tipped recently (24hr cooldown)
            if (await recentlyTipped(username)) {
                console.log(`[Rumble] @${username} — tipped recently, skipping`);
                continue;
            }
            // Agent evaluates creator
            const evaluation = await (0, evaluator_1.evaluateRumbleCreator)(metrics);
            console.log(`[Rumble] @${username}: score=${evaluation.totalScore}, tier=${evaluation.tier}`);
            // --- MILESTONE LOGIC ---
            await checkMilestones(username, metrics);
            if (!evaluation.sendTip || evaluation.amountUsdt === 0) {
                console.log(`[Rumble] @${username} — no regular tip: ${evaluation.skipReason}`);
                continue;
            }
            // Execute tip via WDK
            const result = await (0, tipper_1.executeRumbleTip)(metrics, evaluation);
            if (result.success) {
                if (result.txHash) {
                    console.log(`[Rumble] ✅ Tipped @${username}: ${evaluation.amountUsdt} USDT (${result.txHash})`);
                }
                else if (result.claimUrl) {
                    console.log(`[Rumble] 🔗 Claim for @${username}: ${result.claimUrl}`);
                }
            }
            // Rate limit: 2 second delay between creators
            await new Promise(r => setTimeout(r, 2000));
        }
        catch (err) {
            console.error(`[Rumble] Error processing @${username}:`, err);
        }
    }
}
async function checkMilestones(username, metrics) {
    const db = await (0, database_1.getDatabase)();
    const milestones = [
        { key: 'VIEWS_100', threshold: 100, field: 'latest_views', reward: 1.0 },
        { key: 'VIEWS_500', threshold: 500, field: 'latest_views', reward: 5.0 },
        { key: 'VIEWS_1000', threshold: 1000, field: 'latest_views', reward: 10.0 },
        { key: 'SUBS_100', threshold: 100, field: 'subscribers', reward: 2.0 },
    ];
    for (const m of milestones) {
        const currentValue = metrics[m.field === 'latest_views' ? 'latestViews' : 'subscribers'] || 0;
        if (currentValue >= m.threshold) {
            // Check if already rewarded
            const exists = await db.get('SELECT 1 FROM rumble_milestones WHERE username = ? AND milestone_key = ?', username, m.key);
            if (!exists) {
                console.log(`[Rumble] 🏆 Milestone Hit! @${username} reached ${m.threshold} ${m.field}`);
                // Execute Milestone Tip
                const evaluation = {
                    sendTip: true,
                    amountUsdt: m.reward,
                    tier: 'OUTSTANDING',
                    scores: { contentQuality: 25, momentum: 25, consistency: 25, communityImpact: 20 },
                    totalScore: 95,
                    reasoning: `Milestone Achievement: Reached ${m.threshold} ${m.field.replace('_', ' ')} on Rumble. Keep it up!`
                };
                const result = await (0, tipper_1.executeRumbleTip)(metrics, evaluation);
                if (result.success) {
                    await db.run('INSERT INTO rumble_milestones (username, milestone_key) VALUES (?, ?)', username, m.key);
                    // Also flag the rumble_tip as a milestone tip
                    if (result.txHash || result.claimUrl) {
                        await db.run('UPDATE rumble_tips SET tip_type = ? WHERE username = ? ORDER BY created_at DESC LIMIT 1', 'milestone', username);
                    }
                }
            }
        }
    }
}
async function recentlyTipped(username) {
    const db = await (0, database_1.getDatabase)();
    const result = await db.get(`
    SELECT COUNT(*) as count FROM rumble_tips
    WHERE username = ? AND tipped = 1
    AND created_at > datetime('now', '-24 hours')
  `, username);
    return (result?.count || 0) > 0;
}
