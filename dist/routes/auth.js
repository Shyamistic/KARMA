"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../lib/db");
const router = (0, express_1.Router)();
const db = (0, db_1.getPrisma)();
// Secret for JWT (should be in env, fallback for testing)
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-karma-key';
// Middleware to protect routes
async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    // Check if token is revoked
    const revoked = await db.revokedToken.findUnique({ where: { token } });
    if (revoked) {
        return res.status(401).json({ error: 'Token revoked' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.token = token;
        req.tokenExp = decoded.exp;
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'Email and password required' });
    try {
        const hash = await bcryptjs_1.default.hash(password, 12);
        const user = await db.user.create({ data: { email, passwordHash: hash } });
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, email } });
    }
    catch (err) {
        if (err.code === 'P2002')
            return res.status(400).json({ error: 'Email already exists' });
        res.status(500).json({ error: 'Failed to create user' });
    }
});
router.post('/login', async (req, res) => {
    const { password, email } = req.body;
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';
    // 1. Admin Password Fallback (Demo Mode)
    // This allows login even if the DB is unreachable
    if (password === ADMIN_PASS) {
        console.log('[Auth] Admin login successful via Master Password');
        const token = jsonwebtoken_1.default.sign({ userId: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ token, user: { id: 'admin', email: 'admin@karma.local' } });
    }
    // 2. Regular User Login (Database Dependent)
    try {
        if (!email || !password)
            return res.status(400).json({ error: 'Credentials required' });
        const user = await db.user.findUnique({ where: { email } });
        if (!user || !(await bcryptjs_1.default.compare(password, user.passwordHash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, email } });
    }
    catch (err) {
        console.error('[Auth] Login error:', err.message);
        res.status(502).json({ error: 'Database unreachable. Use Admin Password.' });
    }
});
router.post('/logout', authenticate, async (req, res) => {
    if (req.token && req.tokenExp) {
        await db.revokedToken.create({
            data: { token: req.token, expiresAt: new Date(req.tokenExp * 1000) }
        });
    }
    res.json({ ok: true });
});
exports.default = router;
