"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrisma = getPrisma;
exports.getDatabase = getDatabase;
exports.saveTip = saveTip;
exports.getRecentTips = getRecentTips;
exports.getMonitoredCreators = getMonitoredCreators;
exports.addCreator = addCreator;
exports.saveMetricsSnapshot = saveMetricsSnapshot;
exports.saveRumbleTip = saveRumbleTip;
exports.getRumbleTips = getRumbleTips;
exports.createClaimRecord = createClaimRecord;
exports.getClaimByToken = getClaimByToken;
exports.markClaimed = markClaimed;
exports.getTippingPools = getTippingPools;
exports.createTippingPool = createTippingPool;
exports.getAggregateStats = getAggregateStats;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function getPrisma() {
    return prisma;
}
// Legacy compatibility (if needed)
async function getDatabase() {
    return prisma;
}
// --- GITHUB TIPS ---
async function saveTip(data) {
    return prisma.githubTip.create({
        data: {
            prNumber: data.prNumber,
            prTitle: data.prTitle,
            prUrl: data.prUrl,
            repoName: data.repoName,
            contributor: data.contributor,
            amountUsdt: data.amountUsdt || 0,
            totalScore: data.totalScore || 0,
            reasoning: data.reasoning,
            txHash: data.txHash,
            tipped: data.tipped || false
        }
    });
}
async function getRecentTips(limit = 20) {
    return prisma.githubTip.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit
    });
}
// --- RUMBLE ---
async function getMonitoredCreators() {
    const creators = await prisma.rumbleCreator.findMany({
        where: { active: true },
        select: { username: true }
    });
    return creators.map((c) => c.username);
}
async function addCreator(username, walletAddress) {
    return prisma.rumbleCreator.upsert({
        where: { username },
        update: {
            walletAddress: walletAddress || undefined,
            active: true
        },
        create: {
            username,
            walletAddress: walletAddress || undefined,
            active: true
        }
    });
}
async function saveMetricsSnapshot(metrics) {
    return prisma.rumbleMetric.create({
        data: {
            username: metrics.username,
            subscribers: metrics.subscribers,
            latestViews: metrics.latestVideoViews,
            viewVelocity: metrics.viewVelocity,
            isLive: metrics.isLive,
            totalVideos: metrics.totalVideos,
            engagementRate: metrics.engagementRate,
            consistencyScore: metrics.consistencyScore,
            latestVideoTitle: metrics.latestVideoTitle,
            latestVideoUrl: metrics.latestVideoUrl,
            checkedAt: new Date(metrics.lastChecked)
        }
    });
}
async function saveRumbleTip(data) {
    return prisma.rumbleTip.create({
        data: {
            username: data.username,
            displayName: data.displayName,
            videoTitle: data.videoTitle,
            videoUrl: data.videoUrl,
            walletAddress: data.walletAddress,
            amountUsdt: data.amountUsdt || 0,
            tier: data.tier,
            totalScore: data.totalScore || 0,
            reasoning: data.reasoning,
            recipientsJson: data.recipientsJson, // For Smart Splits
            claimToken: data.claimToken,
            txHash: data.txHash,
            tipped: data.tipped || false,
            tipType: data.tipType || 'direct'
        }
    });
}
async function getRumbleTips(limit = 20) {
    return prisma.rumbleTip.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit
    });
}
// --- CLAIMS ---
async function createClaimRecord(data) {
    return prisma.claim.create({
        data: {
            id: data.id,
            claimToken: data.claimToken,
            contributor: data.contributor,
            amountUsdt: data.amountUsdt,
            prUrl: data.prUrl,
            prTitle: data.prTitle,
            repoName: data.repoName,
            tier: data.tier,
            reasoning: data.reasoning,
            totalScore: data.totalScore,
            createdAt: new Date(data.createdAt),
            expiresAt: new Date(data.expiresAt),
            claimed: data.claimed,
            platform: data.platform
        }
    });
}
async function getClaimByToken(token) {
    return prisma.claim.findUnique({
        where: { claimToken: token }
    });
}
async function markClaimed(token, txHash, address) {
    return prisma.claim.update({
        where: { claimToken: token },
        data: {
            claimed: true,
            txHash,
            claimedBy: address,
            claimedAt: new Date()
        }
    });
}
// --- POOLS ---
async function getTippingPools() {
    return prisma.tippingPool.findMany({
        where: { active: true },
        orderBy: { createdAt: 'desc' }
    });
}
async function createTippingPool(data) {
    return prisma.tippingPool.create({
        data: {
            name: data.name,
            description: data.description,
            totalUsdt: data.initialUsdt || 0
        }
    });
}
// --- STATS ---
async function getAggregateStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [ghTotal, ghToday, rmTotal, rmToday, pending, pools] = await Promise.all([
        // GitHub Total
        prisma.githubTip.aggregate({
            _count: true,
            _sum: { amountUsdt: true },
            where: { tipped: true }
        }),
        // GitHub Today
        prisma.githubTip.aggregate({
            _count: true,
            _sum: { amountUsdt: true },
            where: { tipped: true, createdAt: { gte: startOfToday } }
        }),
        // Rumble Total
        prisma.rumbleTip.aggregate({
            _count: true,
            _sum: { amountUsdt: true },
            where: { tipped: true }
        }),
        // Rumble Today
        prisma.rumbleTip.aggregate({
            _count: true,
            _sum: { amountUsdt: true },
            where: { tipped: true, createdAt: { gte: startOfToday } }
        }),
        // Pending
        prisma.claim.aggregate({
            _count: true,
            _sum: { amountUsdt: true },
            where: { claimed: false, expiresAt: { gt: now } }
        }),
        // Pools
        prisma.pool.aggregate({
            _sum: { balanceUsdt: true },
            where: { isActive: true }
        })
    ]);
    return {
        github: {
            totalTips: ghTotal._count || 0,
            totalUsdt: ghTotal._sum.amountUsdt || 0,
            tipsToday: ghToday._count || 0
        },
        rumble: {
            totalTips: rmTotal._count || 0,
            totalUsdt: rmTotal._sum.amountUsdt || 0,
            tipsToday: rmToday._count || 0
        },
        pool: {
            pendingClaims: pending._count || 0,
            pendingUsdt: pending._sum.amountUsdt || 0,
            totalInPools: pools._sum.balanceUsdt || 0
        }
    };
}
