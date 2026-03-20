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
const config_1 = require("./lib/config");
const routes_1 = __importDefault(require("./api/routes"));
const auth_1 = __importDefault(require("./routes/auth"));
const pools_1 = __importDefault(require("./routes/pools"));
const wdk_1 = require("./core/wdk");
const scheduler_1 = require("./services/rumble/scheduler");
const app = (0, express_1.default)();
exports.httpServer = (0, http_1.createServer)(app);
exports.io = new socket_io_1.Server(exports.httpServer, {
    cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173' }
});
exports.io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`[WS] Disconnected: ${socket.id}`));
});
const PORT = config_1.config.PORT || 3000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
app.use((0, cors_1.default)());
// Serve React Frontend
const distPath = path_1.default.join(process.cwd(), 'frontend/dist');
app.use(express_1.default.static(distPath));
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
        return next();
    }
    res.sendFile(path_1.default.join(distPath, 'index.html'));
});
// API Routes
app.use(routes_1.default);
app.use('/api/auth', auth_1.default);
app.use('/api/pools', pools_1.default);
// Fallback for SPA (if claim or dashboard routes are handled by client)
app.get('/claim/:token', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/claim.html'));
});
async function bootstrap() {
    const wallet = await (0, wdk_1.getWallet)();
    const ethBalance = await wallet.getEthBalance();
    const tokenBalance = await wallet.getTokenBalance();
    console.log(`[Karma] Oracle Address: ${await wallet.getAddress()}`);
    console.log(`[Karma] Balance: ${tokenBalance} USD₮ | Gas: ${ethBalance} ETH`);
    if (parseFloat(tokenBalance) === 0) {
        console.warn(`[Karma] ⚠️ Warning: 0 USD₮ balance. Funding required!`);
    }
    // Start background services
    (0, scheduler_1.startRumbleScheduler)();
    exports.httpServer.listen(PORT, async () => {
        console.log(`✅ Karma Oracle v3.0 (${process.env.NODE_ENV || 'Production'}) running on port ${PORT}`);
        console.log(`🔗 Dashboard: http://localhost:${PORT}`);
    });
}
bootstrap().catch(err => {
    console.error('💥 Core system failure:', err);
    process.exit(1);
});
