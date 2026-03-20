"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClaim = createClaim;
exports.getClaimByToken = getClaimByToken;
exports.redeemClaim = redeemClaim;
exports.getClaimUrl = getClaimUrl;
const uuid_1 = require("uuid");
const db_1 = require("../../lib/db");
const wdk_1 = require("../../core/wdk");
const config_1 = require("../../lib/config");
async function createClaim(params) {
    const claimToken = generateSecureToken();
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const claim = {
        id: (0, uuid_1.v4)(),
        claimToken,
        contributor: params.contributor,
        amountUsdt: params.amountUsdt,
        prUrl: params.prUrl,
        prTitle: params.prTitle,
        repoName: params.repoName,
        tier: params.tier,
        reasoning: params.reasoning,
        totalScore: params.totalScore,
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        claimed: false,
        platform: params.platform || 'github'
    };
    await (0, db_1.createClaimRecord)(claim);
    console.log(`[Claims] Created claim ${claimToken} for @${params.contributor} — ${params.amountUsdt} USDT`);
    return claim;
}
async function getClaimByToken(token) {
    const claim = await (0, db_1.getClaimByToken)(token);
    return claim || null;
}
async function redeemClaim(token, walletAddress) {
    const claim = await getClaimByToken(token);
    if (!claim) {
        return { success: false, error: 'Claim not found' };
    }
    if (claim.claimed) {
        return { success: false, error: 'This reward has already been claimed' };
    }
    const now = new Date();
    if (now > new Date(claim.expiresAt)) {
        return { success: false, error: 'This claim link has expired (7-day limit)' };
    }
    if (!isValidEvmAddress(walletAddress)) {
        return { success: false, error: 'Invalid wallet address' };
    }
    try {
        const wallet = await (0, wdk_1.getWallet)();
        const txHash = await wallet.sendToken(walletAddress, claim.amountUsdt);
        await (0, db_1.markClaimed)(token, txHash, walletAddress);
        const prisma = (0, db_1.getPrisma)();
        await prisma.githubTip.updateMany({
            where: { claimToken: token },
            data: { txHash, tipped: true }
        });
        console.log(`[Claims] Redeemed: ${claim.amountUsdt} USDT → ${walletAddress} | tx: ${txHash}`);
        return { success: true, txHash };
    }
    catch (err) {
        console.error('[Claims] Redemption failed:', err);
        return { success: false, error: err.message || 'Transfer failed' };
    }
}
function getClaimUrl(token) {
    return `${config_1.config.BASE_URL}/claim/${token}`;
}
function generateSecureToken() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
        token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
}
function isValidEvmAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}
