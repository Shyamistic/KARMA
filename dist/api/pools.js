"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// GET /api/pools
router.get('/', async (req, res) => {
    try {
        const pools = await (0, db_1.getTippingPools)();
        res.json(pools);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch pools' });
    }
});
// POST /api/pools
const CreatePoolSchema = zod_1.z.object({
    name: zod_1.z.string().min(3),
    description: zod_1.z.string().optional(),
    initialUsdt: zod_1.z.number().optional()
});
router.post('/', async (req, res) => {
    try {
        const data = CreatePoolSchema.parse(req.body);
        const pool = await (0, db_1.createTippingPool)(data);
        res.json(pool);
    }
    catch (err) {
        res.status(400).json({ error: 'Invalid pool data' });
    }
});
// POST /api/pools/:id/contribute (Simulated)
router.post('/:id/contribute', async (req, res) => {
    try {
        const { amount } = req.body;
        const prisma = (0, db_1.getPrisma)();
        const pool = await prisma.tippingPool.update({
            where: { id: req.params.id },
            data: { totalUsdt: { increment: amount || 10 } }
        });
        res.json(pool);
    }
    catch (err) {
        res.status(404).json({ error: 'Pool not found' });
    }
});
exports.default = router;
