"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRumbleScheduler = startRumbleScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const monitor_1 = require("./monitor");
const evaluator_1 = require("./evaluator");
const tipper_1 = require("./tipper");
const db_1 = require("../../lib/db");
function startRumbleScheduler() {
    // Run every 30 minutes
    node_cron_1.default.schedule('*/30 * * * *', async () => {
        try {
            await runRumbleCheck();
        }
        catch (e) {
            console.error('[Scheduler] Regular check failed:', e.message);
        }
    });
    // Run immediately on startup (with safety)
    setTimeout(async () => {
        try {
            await runRumbleCheck();
        }
        catch (e) {
            console.error('[Scheduler] Initial startup check failed:', e.message);
        }
    }, 5000);
    // Fast loop — every 5 minutes
    setInterval(() => {
        runFastEventMonitor().catch(e => console.error('[Scheduler] Event monitor error:', e.message));
    }, 5 * 60 * 1000);
    console.log('[Rumble] Scheduler started — Resilience Mode Active');
}
async function runFastEventMonitor() {
    const prisma = (0, db_1.getPrisma)();
    const creators = await prisma.rumbleCreator.findMany({
        where: { active: true },
        include: { metrics: { orderBy: { checkedAt: 'desc' }, take: 2 } }
    });
    for (const creator of creators) {
        try {
            const fresh = await (0, monitor_1.fetchCreatorMetrics)(creator.username);
            const prev = creator.metrics[0];
            if (!prev || !fresh)
                continue;
            // Check viral spike (views gained since last check)
            const viewsGained = fresh.latestVideoViews - prev.latestViews;
            if (viewsGained >= 5000) {
                console.log(`[EVENT] ${creator.username} viral spike: +${viewsGained} views detected by Fast Loop`);
                // Execute dynamic smart evaluation 
                const evaluation = {
                    sendTip: true,
                    amountUsdt: 15.0,
                    tier: 'VIRAL',
                    totalScore: 92,
                    reasoning: `Fast Loop Detection: Viral spike of +${viewsGained} views within the last 5 minutes.`,
                    tipType: 'viral'
                };
                await (0, tipper_1.executeRumbleTip)(fresh, evaluation);
            }
        }
        catch (e) {
            // ignore
        }
        finally {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
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
        }
        catch (err) {
            console.error(`[Rumble] Error processing @${username}:`, err);
        }
        finally {
            // Rate limit: 2 second delay between creators
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}
async function checkMilestones(username, metrics) {
    const prisma = (0, db_1.getPrisma)();
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
            const existing = await prisma.rumbleMilestone.findFirst({
                where: { username, milestoneKey: m.key }
            });
            if (!existing) {
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
                    await prisma.rumbleMilestone.create({
                        data: { username, milestoneKey: m.key }
                    });
                    // Also flag the rumble_tip as a milestone tip
                    if (result.txHash || result.claimUrl) {
                        // Find the latest tip we just created
                        const latestTip = await prisma.rumbleTip.findFirst({
                            where: { username },
                            orderBy: { createdAt: 'desc' }
                        });
                        if (latestTip) {
                            await prisma.rumbleTip.update({
                                where: { id: latestTip.id },
                                data: { tipType: 'milestone' }
                            });
                        }
                    }
                }
            }
        }
    }
}
async function recentlyTipped(username) {
    const prisma = (0, db_1.getPrisma)();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await prisma.rumbleTip.count({
        where: {
            username,
            tipped: true,
            createdAt: { gte: yesterday }
        }
    });
    return count > 0;
}
