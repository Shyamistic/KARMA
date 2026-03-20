"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const auth_1 = require("./auth");
const router = (0, express_1.Router)();
const db = (0, db_1.getPrisma)();
// POST /pools — create a tipping pool
router.post('/', auth_1.authenticate, async (req, res) => {
    const { name, targetCreator, splitConfig } = req.body;
    if (!name)
        return res.status(400).json({ error: 'Name is required' });
    try {
        const pool = await db.pool.create({
            data: {
                name,
                targetCreator,
                splitConfig: splitConfig || { creator: 1.0 },
                ownerId: req.userId
            }
        });
        res.json(pool);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create pool' });
    }
});
// POST /pools/:id/deposit — user deposits USDT into pool
router.post('/:id/deposit', auth_1.authenticate, async (req, res) => {
    const { amountUsdt } = req.body;
    const poolId = req.params.id;
    if (!amountUsdt || amountUsdt <= 0) {
        return res.status(400).json({ error: 'Valid amountUsdt required' });
    }
    // MVP ONLY: Simulating deposit confirmation.
    // In production, an on-chain verification hook from WDK would trigger this.
    try {
        const pool = await db.pool.update({
            where: { id: poolId },
            data: {
                balanceUsdt: { increment: amountUsdt }
            }
        });
        res.json({ success: true, newBalance: pool.balanceUsdt });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to deposit to pool' });
    }
});
// GET /pools/:id/stats — live pool balance, tips sent, contributors
router.get('/:id/stats', async (req, res) => {
    try {
        const pool = await db.pool.findUnique({
            where: { id: req.params.id },
            include: {
                tips: { orderBy: { createdAt: 'desc' }, take: 50 },
                owner: { select: { email: true } }
            }
        });
        if (!pool)
            return res.status(404).json({ error: 'Pool not found' });
        const totalTipped = pool.tips.reduce((sum, tip) => sum + tip.amountUsdt, 0);
        res.json({
            ...pool,
            totalTipped,
            tipCount: pool.tips.length
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch pool stats' });
    }
});
// GET /pools — list all pools
router.get('/', async (req, res) => {
    try {
        const pools = await db.pool.findMany({
            include: { owner: { select: { email: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(pools);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to list pools' });
    }
});
exports.default = router;
