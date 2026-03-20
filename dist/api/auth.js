"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.logout = logout;
exports.checkStatus = checkStatus;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../lib/config");
async function login(req, res) {
    const { password } = req.body;
    if (password === config_1.config.ADMIN_PASSWORD) {
        const token = jsonwebtoken_1.default.sign({ admin: true }, config_1.config.JWT_SECRET, { expiresIn: '24h' });
        // Set cookie for browser-based dashboard
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        return res.json({ success: true, token });
    }
    return res.status(401).json({ error: 'Invalid password' });
}
function logout(req, res) {
    res.clearCookie('auth_token');
    res.json({ success: true });
}
function checkStatus(req, res) {
    res.json({ authenticated: true, admin: req.admin });
}
