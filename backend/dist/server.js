"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const redis_1 = require("./config/redis");
const db_1 = __importDefault(require("./config/db"));
const api_1 = __importDefault(require("./routes/api"));
const jobs_1 = require("./cron/jobs");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Trust proxy (Nginx/DigitalOcean ke liye zaroori)
app.set('trust proxy', 1);
// Security Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
// Rate Limiting - Testing ke liye relaxed
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100000000,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use('/avatars', express_1.default.static(path_1.default.join(__dirname, '../public/avatars')));
// API Routes
app.use('/api', api_1.default);
// Initialize Cron Jobs
(0, jobs_1.initCronJobs)();
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
const startServer = async () => {
    try {
        await db_1.default.query('SELECT NOW()');
        console.log('PostgreSQL Connected');
        await (0, redis_1.connectRedis)();
        app.listen(Number(PORT), '0.0.0.0', () => {
            console.log(`Server running on http://0.0.0.0:${PORT}`);
            // VpnService.startMonitoring(); // Temporarily disabled for local dev
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
