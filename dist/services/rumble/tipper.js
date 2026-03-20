"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeRumbleTip = executeRumbleTip;
const wdk_1 = require("../../core/wdk");
const db_1 = require("../../lib/db");
const config_1 = require("../../lib/config");
const uuid_1 = require("uuid");
async function executeRumbleTip(creator, evaluation) {
    const prisma = (0, db_1.getPrisma)();
    // Get creator's wallet address from registry
    const creatorData = await prisma.rumbleCreator.findUnique({
        where: { username: creator.username },
        select: { walletAddress: true }
    });
    const walletAddress = creatorData?.walletAddress;
    if (walletAddress) {
        // Direct tip — creator has a wallet address registered
        try {
            const wallet = await (0, wdk_1.getWallet)();
            const txHash = await wallet.sendToken(walletAddress, evaluation.amountUsdt);
            // Log the tip
            await (0, db_1.saveRumbleTip)({
                username: creator.username,
                displayName: creator.displayName,
                videoTitle: creator.latestVideoTitle,
                videoUrl: creator.latestVideoUrl,
                walletAddress,
                amountUsdt: evaluation.amountUsdt,
                tier: evaluation.tier,
                totalScore: evaluation.totalScore,
                reasoning: evaluation.reasoning,
                txHash,
                tipped: true,
                tipType: 'direct'
            });
            console.log(`[Karma] Tipped @${creator.username}: ${evaluation.amountUsdt} USD₮ → ${walletAddress} (${txHash})`);
            return { success: true, txHash };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    else {
        // No wallet — create claimable link
        const claimToken = generateToken();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        // Create claim record
        await (0, db_1.createClaimRecord)({
            id: (0, uuid_1.v4)(),
            claimToken,
            contributor: creator.username,
            amountUsdt: evaluation.amountUsdt,
            prUrl: creator.latestVideoUrl,
            prTitle: creator.latestVideoTitle,
            repoName: `rumble.com/c/${creator.username}`,
            tier: evaluation.tier,
            reasoning: evaluation.reasoning,
            totalScore: evaluation.totalScore,
            createdAt: now.toISOString(),
            expiresAt: expiresAt,
            claimed: false,
            platform: 'rumble'
        });
        // Log the tip as claimable
        await (0, db_1.saveRumbleTip)({
            username: creator.username,
            displayName: creator.displayName,
            videoTitle: creator.latestVideoTitle,
            videoUrl: creator.latestVideoUrl,
            amountUsdt: evaluation.amountUsdt,
            tier: evaluation.tier,
            totalScore: evaluation.totalScore,
            reasoning: evaluation.reasoning,
            claimToken,
            tipped: false,
            tipType: 'claimable'
        });
        const claimUrl = `${config_1.config.BASE_URL}/claim/${claimToken}`;
        console.log(`[Karma] Claim created for @${creator.username}: ${claimUrl}`);
        return { success: true, claimToken, claimUrl };
    }
}
function generateToken() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
