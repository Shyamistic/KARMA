"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function req(k) {
    const v = process.env[k];
    if (!v)
        throw new Error(`Missing: ${k}`);
    return v;
}
exports.config = {
    PORT: parseInt(process.env.PORT || '3000'),
    BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    GROQ_API_KEY: req('GROQ_API_KEY'),
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    WDK_SEED_PHRASE: req('WDK_SEED_PHRASE'),
    WDK_CHAIN: process.env.WDK_CHAIN || 'arbitrum_sepolia',
    GITHUB_TOKEN: req('GITHUB_TOKEN'),
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET || '',
    MONITORED_REPOS: (process.env.MONITORED_REPOS || '').split(',').filter(Boolean),
    DAILY_BUDGET_USDT: parseFloat(process.env.DAILY_BUDGET_USDT || '100'),
    RUMBLE_CHECK_INTERVAL_MINUTES: parseInt(process.env.RUMBLE_CHECK_INTERVAL_MINUTES || '30'),
};
