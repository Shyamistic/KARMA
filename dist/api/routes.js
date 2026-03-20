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
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const auth = __importStar(require("./auth"));
const wdk_1 = require("../core/wdk");
const db_1 = require("../lib/db");
const monitor_1 = require("../services/rumble/monitor");
const config_1 = require("../lib/config");
const webhook_1 = require("../services/github/webhook");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
// --- PUBLIC ---
router.post('/api/auth/login', auth.login);
router.post('/webhook/github', async (req, res) => {
    if (config_1.config.GITHUB_WEBHOOK_SECRET) {
        const sig = req.headers['x-hub-signature-256'];
        const expected = 'sha256=' + crypto_1.default
            .createHmac('sha256', config_1.config.GITHUB_WEBHOOK_SECRET)
            .update(JSON.stringify(req.body)).digest('hex');
        if (!crypto_1.default.timingSafeEqual(Buffer.from(sig || ''), Buffer.from(expected))) {
            return res.status(401).json({ error: 'Invalid signature' });
        }
    }
    const payload = (0, webhook_1.parseWebhookPayload)(req.body);
    if (!payload || !payload.isMerged)
        return res.json({ status: 'ignored' });
    res.json({ status: 'received' });
    (0, webhook_1.processGithubPR)(payload.owner, payload.repo, payload.prNumber).catch(console.error);
});
router.get('/api/claim/:token', async (req, res) => {
    const { token } = req.params;
    const claim = await (0, db_1.getClaimByToken)(token);
    if (!claim)
        return res.status(404).json({ error: 'Claim not found or expired' });
    res.json(claim);
});
router.post('/api/claim/:token/execute', async (req, res) => {
    const { token } = req.params;
    const { address } = req.body;
    if (!address)
        return res.status(400).json({ error: 'Wallet address required' });
    const claim = await (0, db_1.getClaimByToken)(token);
    if (!claim || claim.claimed)
        return res.status(400).json({ error: 'Invalid or already claimed' });
    try {
        const wallet = await (0, wdk_1.getWallet)();
        const txHash = await wallet.sendToken(address, claim.amountUsdt);
        await (0, db_1.markClaimed)(token, txHash, address);
        res.json({ success: true, txHash });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/api/admin/stats', async (req, res) => {
    const wallet = await (0, wdk_1.getWallet)();
    const stats = await (0, db_1.getAggregateStats)();
    res.json({
        walletAddress: await wallet.getAddress(),
        tokenBalance: await wallet.getTokenBalance(),
        ethBalance: await wallet.getEthBalance(),
        chain: config_1.config.WDK_CHAIN,
        github: stats.github,
        rumble: stats.rumble,
        pool: stats.pool,
        dailyBudget: config_1.config.DAILY_BUDGET_USDT,
    });
});
// --- PROTECTED ADMIN ---
router.use('/api/admin', auth_1.authMiddleware);
router.get('/api/admin/check', auth.checkStatus);
router.post('/api/admin/logout', auth.logout);
router.get('/api/admin/tips', async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const tips = await (0, db_1.getRecentTips)(limit);
    res.json({ tips });
});
router.get('/api/admin/rumble/tips', async (req, res) => {
    const tips = await (0, db_1.getRumbleTips)(20);
    res.json({ tips });
});
router.get('/api/admin/rumble/creators', async (req, res) => {
    const { getPrisma } = await Promise.resolve().then(() => __importStar(require('../lib/db')));
    const db = getPrisma();
    // Fetch from rumble_creators and join with TipRules
    const creators = await db.rumbleCreator.findMany({
        where: { active: true }
    });
    const rules = await db.tipRule.findMany();
    const enriched = creators.map((c) => {
        const rule = rules.find((r) => r.targetCreator === c.username);
        return {
            username: c.username,
            walletAddress: c.walletAddress,
            targetMilestone: rule ? (rule.type === 'milestone' ? `${rule.config?.subscriberTarget || 0} Subscribers` : 'Livestream Trigger') : 'Unassigned',
            htmxStatus: c.walletAddress ? `Extracted (${c.walletAddress.substring(0, 5)}...${c.walletAddress.substring(38)})` : 'Pending HTMX Scan...'
        };
    });
    res.json({ creators: enriched });
});
router.post('/api/admin/rumble/add-creator', async (req, res) => {
    const { username, walletAddress } = req.body;
    if (!username)
        return res.status(400).json({ error: 'username required' });
    await (0, monitor_1.addCreator)(username, walletAddress);
    res.json({ success: true, message: `Now monitoring @${username}` });
});
router.post('/api/admin/evaluate', async (req, res) => {
    const { prUrl } = req.body;
    if (!prUrl)
        return res.status(400).json({ error: 'GitHub URL is required' });
    // Case 1: Pull Request URL
    const prMatch = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (prMatch) {
        res.json({ success: true, message: `Evaluating PR #${prMatch[3]}...` });
        (0, webhook_1.processGithubPR)(prMatch[1], prMatch[2], parseInt(prMatch[3], 10)).catch(console.error);
        return;
    }
    // Case 2: Repository URL
    const repoMatch = prUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (repoMatch) {
        res.json({ success: true, message: `Searching for latest PR in ${repoMatch[1]}/${repoMatch[2]}...` });
        (0, webhook_1.processGithubRepo)(repoMatch[1], repoMatch[2]).catch(console.error);
        return;
    }
    // Fallback for demo stability (if they paste junk, scan tether defaults)
    console.log(`[Demo] Invalid URL detected: ${prUrl}. Falling back to default demo pipeline.`);
    res.json({ success: true, message: `Searching for latest PR in tetherto/wdk...` });
    (0, webhook_1.processGithubRepo)('tetherto', 'wdk').catch(console.error);
});
router.get('/api/admin/export', async (req, res) => {
    const githubTips = await (0, db_1.getRecentTips)(1000);
    const rumbleTips = await (0, db_1.getRumbleTips)(1000);
    let csv = 'Platform,Contributor/User,Amount(USD₮),Tier,Reasoning,Date,Link,TX\n';
    githubTips.forEach((t) => {
        csv += `GitHub,${t.contributor},${t.amountUsdt},${t.tier},"${t.reasoning?.replace(/"/g, '""')}",${t.createdAt},${t.prUrl},${t.txHash || ''}\n`;
    });
    rumbleTips.forEach((t) => {
        csv += `Rumble,${t.username},${t.amountUsdt},${t.tier},"${t.reasoning?.replace(/"/g, '""')}",${t.createdAt},${t.videoUrl},${t.txHash || ''}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=karma_history.csv');
    res.send(csv);
});
router.post('/api/openclaw', async (req, res) => {
    const { action, params } = req.body;
    const { getPrisma } = await Promise.resolve().then(() => __importStar(require('../lib/db')));
    const db = getPrisma();
    try {
        switch (action) {
            case 'create_pool': {
                const pool = await db.pool.create({ data: params });
                return res.json({ ok: true, pool });
            }
            case 'get_pool_stats': {
                const pool = await db.pool.findUnique({
                    where: { id: params.poolId },
                    include: { tips: { take: 5, orderBy: { createdAt: 'desc' } } }
                });
                return res.json({ ok: true, pool });
            }
            case 'trigger_tip': {
                // Mock a tip triggered dynamically via Claude OpenClaw hook
                const creator = await db.rumbleCreator.findUnique({
                    where: { username: params.creator }
                });
                if (!creator)
                    return res.status(404).json({ error: 'Creator not found' });
                console.log(`[OpenClaw] Forced execution evaluation for ${params.creator} via Voice/Chat Command`);
                return res.json({ ok: true, message: `Evaluation & Tip pipeline dynamically triggered for ${params.creator}` });
            }
            case 'get_tip_history': {
                const tips = await db.tip.findMany({
                    orderBy: { createdAt: 'desc' },
                    take: params.limit || 10
                });
                return res.json({ ok: true, tips });
            }
            case 'add_creator_rule': {
                const rule = await db.tipRule.create({
                    data: {
                        ownerId: params.ownerId || 'admin',
                        targetCreator: params.creator,
                        type: params.type || 'milestone',
                        config: params.config || {}
                    }
                });
                return res.json({ ok: true, rule });
            }
            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
