"use strict";
/**
 * Rumble Tip Executor
 * Sends USDT tips to Rumble creator wallets via WDK
 *
 * Creator wallet addresses are stored in the database.
 * Admins can add creator wallet addresses via the dashboard.
 * Creators can also claim tips if they don't have a wallet yet (same
 * claimable link system as GitHub).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeRumbleTip = executeRumbleTip;
const wdk_1 = require("../wdk");
const database_1 = require("../database");
const config_1 = require("../config");
const uuid_1 = require("uuid");
async function executeRumbleTip(creator, evaluation) {
    const db = await (0, database_1.getDatabase)();
    // Get creator's wallet address
    const creatorRow = await db.get('SELECT wallet_address FROM rumble_creators WHERE username = ?', creator.username);
    const walletAddress = creatorRow?.wallet_address;
    if (walletAddress) {
        // Direct tip — creator has a wallet address registered
        try {
            const wallet = await (0, wdk_1.getWallet)();
            const txHash = await wallet.sendToken(walletAddress, evaluation.amountUsdt);
            // Log the tip
            await db.run(`
        INSERT INTO rumble_tips (
          username, display_name, video_title, video_url,
          wallet_address, amount_usdt, tier, total_score, reasoning,
          tx_hash, tipped, tip_type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'direct', datetime('now'))
      `, creator.username, creator.displayName, creator.latestVideoTitle, creator.latestVideoUrl, walletAddress, evaluation.amountUsdt, evaluation.tier, evaluation.totalScore, evaluation.reasoning, txHash);
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
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await db.run(`
      INSERT INTO claims (
        id, claim_token, contributor, amount_usdt, pr_url, pr_title,
        repo_name, tier, reasoning, total_score,
        created_at, expires_at, claimed, platform
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 0, 'rumble')
    `, (0, uuid_1.v4)(), claimToken, creator.username, evaluation.amountUsdt, creator.latestVideoUrl, creator.latestVideoTitle, `rumble.com/c/${creator.username}`, evaluation.tier, evaluation.reasoning, evaluation.totalScore, expires.toISOString());
        await db.run(`
      INSERT INTO rumble_tips (
        username, display_name, video_title, video_url,
        wallet_address, amount_usdt, tier, total_score, reasoning,
        claim_token, tipped, tip_type, created_at
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 0, 'claimable', datetime('now'))
    `, creator.username, creator.displayName, creator.latestVideoTitle, creator.latestVideoUrl, evaluation.amountUsdt, evaluation.tier, evaluation.totalScore, evaluation.reasoning, claimToken);
        const claimUrl = `${config_1.config.BASE_URL}/claim/${claimToken}`;
        console.log(`[Karma] Claim created for @${creator.username}: ${claimUrl}`);
        return { success: true, claimToken, claimUrl };
    }
}
function generateToken() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
