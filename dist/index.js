"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.httpServer = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const routes_1 = __importDefault(require("./api/routes"));
const auth_1 = __importDefault(require("./routes/auth"));
const pools_1 = __importDefault(require("./routes/pools"));
const wdk_1 = require("./core/wdk");
const scheduler_1 = require("./services/rumble/scheduler");
const app = (0, express_1.default)();
exports.httpServer = (0, http_1.createServer)(app);
exports.io = new socket_io_1.Server(exports.httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
exports.io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`[WS] Disconnected: ${socket.id}`));
});
const PORT = Number(process.env.PORT) || 3000;
// Middleware (once each)
app.use((0, cors_1.default)({ origin: '*' }));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// API Routes (MUST come before static/SPA catch-all)
app.use(routes_1.default);
app.use('/api/auth', auth_1.default);
app.use('/api/pools', pools_1.default);
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));
// Serve React Frontend
const distPath = path_1.default.join(process.cwd(), 'frontend/dist');
app.use(express_1.default.static(distPath));
// SPA fallback - catches all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(distPath, 'index.html'));
});
async function bootstrap() {
    // 1. Mandatory Port Alignment
    const appPort = Number(process.env.PORT) || 3000;
    // 2. Start Web Server IMMEDIATELY (Zero dependencies)
    exports.httpServer.listen(appPort, '0.0.0.0', () => {
        console.log(`🚀 Karma Web Service LIVE on 0.0.0.0:${appPort}`);
        console.log(`🌐 Public URL: ${process.env.BASE_URL || 'https://karma-lmrx.onrender.com'}`);
    });
    // 3. Initialize background services asynchronously (Safe wrapper)
    setImmediate(async () => {
        try {
            console.log('[Karma] Initializing stable SQLite local engine...');
            const { execSync } = require('child_process');
            // A. Push schema to internal sqlite file
            console.log('[DB] Synchronizing schema...');
            execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
            // B. Seed demo data (using the compiled JS version)
            console.log('[DB] Seeding high-volume demo data...');
            execSync('node dist/scripts/seed-demo.js', { stdio: 'inherit' });
            console.log('[Karma] Database is now fully armed.');
            const wallet = await (0, wdk_1.getWallet)();
            const ethBalance = await wallet.getEthBalance();
            const tokenBalance = await wallet.getTokenBalance();
            console.log(`[Karma] Oracle Address: ${await wallet.getAddress()}`);
            console.log(`[Karma] Balance: ${tokenBalance} USD₮ | Gas: ${ethBalance} ETH`);
            if (parseFloat(tokenBalance) === 0) {
                console.warn(`[Karma] ⚠️ Warning: 0 USD₮ balance. Funding required!`);
            }
            (0, scheduler_1.startRumbleScheduler)();
        }
        catch (err) {
            console.error('⚠️ Background Initialization delayed:', err.message || err);
            console.log('Retrying background startup in 30 seconds...');
            setTimeout(scheduler_1.startRumbleScheduler, 30000);
        }
    });
}
bootstrap().catch((err) => {
    console.error('⚠️ Critical Bootstrap Warning (Server remains active):', err.message || err);
});
