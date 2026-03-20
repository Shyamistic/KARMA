"use strict";
/**
 * Karma Claims System
 * Generates secure claimable tip links
 * Contributor connects any wallet and claims their USDT reward
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClaim = createClaim;
exports.getClaimByToken = getClaimByToken;
exports.redeemClaim = redeemClaim;
exports.getClaimUrl = getClaimUrl;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const wdk_1 = require("../wdk");
const config_1 = require("../config");
async function createClaim(params) {
    const db = await (0, database_1.getDatabase)();
    const claimToken = generateSecureToken();
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
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
    };
    await db.run(`
    INSERT INTO claims (
      id, claim_token, contributor, amount_usdt, pr_url, pr_title,
      repo_name, tier, reasoning, total_score,
      created_at, expires_at, claimed
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0
    )
  `, claim.id, claim.claimToken, claim.contributor, claim.amountUsdt, claim.prUrl, claim.prTitle, claim.repoName, claim.tier, claim.reasoning, claim.totalScore, claim.createdAt, claim.expiresAt);
    console.log(`[Claims] Created claim ${claimToken} for @${params.contributor} — ${params.amountUsdt} USDT`);
    return claim;
}
async function getClaimByToken(token) {
    const db = await (0, database_1.getDatabase)();
    const row = await db.get('SELECT * FROM claims WHERE claim_token = ?', token);
    return row ? rowToClaim(row) : null;
}
async function redeemClaim(token, walletAddress) {
    const db = await (0, database_1.getDatabase)();
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
    // Validate EVM address
    if (!isValidEvmAddress(walletAddress)) {
        return { success: false, error: 'Invalid wallet address' };
    }
    try {
        // Execute WDK transfer
        const wallet = await (0, wdk_1.getWallet)();
        const txHash = await wallet.sendToken(walletAddress, claim.amountUsdt);
        // Mark claim as redeemed
        await db.run(`
      UPDATE claims
      SET claimed = 1, claimed_by = ?, tx_hash = ?, claimed_at = ?
      WHERE claim_token = ?
    `, walletAddress, txHash, new Date().toISOString(), token);
        // Update tips table with tx hash
        await db.run(`
      UPDATE tips SET tx_hash = ?, tipped = 1 WHERE claim_token = ?
    `, txHash, token);
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
    // URL-safe 32-char token
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
function rowToClaim(row) {
    return {
        id: row.id,
        claimToken: row.claim_token,
        contributor: row.contributor,
        amountUsdt: row.amount_usdt,
        prUrl: row.pr_url,
        prTitle: row.pr_title,
        repoName: row.repo_name,
        tier: row.tier,
        reasoning: row.reasoning,
        totalScore: row.total_score,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        claimed: Boolean(row.claimed),
        claimedBy: row.claimed_by,
        txHash: row.tx_hash,
        claimedAt: row.claimed_at,
    };
}
