"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const configSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().default(3000),
    BASE_URL: zod_1.z.string().url().default('http://localhost:3000'),
    // AI Keys
    GROQ_API_KEY: zod_1.z.string().min(1),
    GEMINI_API_KEY: zod_1.z.string().optional(),
    // WDK & Wallet
    WDK_SEED_PHRASE: zod_1.z.string().min(1),
    WDK_CHAIN: zod_1.z.enum(['ethereum', 'sepolia', 'arbitrum', 'arbitrum_sepolia']).default('sepolia'),
    // GitHub
    GITHUB_TOKEN: zod_1.z.string().min(1),
    GITHUB_WEBHOOK_SECRET: zod_1.z.string().optional(),
    MONITORED_REPOS: zod_1.z.string().default('').transform(s => s.split(',').filter(Boolean)),
    // Tipping Params
    DAILY_BUDGET_USDT: zod_1.z.coerce.number().default(100),
    RUMBLE_CHECK_INTERVAL_MINUTES: zod_1.z.coerce.number().default(30),
    // Security
    ADMIN_PASSWORD: zod_1.z.string().min(6).default('admin123'),
    JWT_SECRET: zod_1.z.string().min(12).default('karma-oracle-super-secret-key-2026'),
});
let _config = null;
try {
    _config = configSchema.parse(process.env);
}
catch (err) {
    if (err instanceof zod_1.z.ZodError) {
        console.error('❌ Invalid environment variables:');
        err.issues.forEach((issue) => {
            console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
        });
    }
    else {
        console.error('❌ Configuration error:', err);
    }
    process.exit(1);
}
exports.config = _config;
