import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectRedis } from './config/redis';
import pool from './config/db';
import apiRoutes from './routes/api';
import { initCronJobs } from './cron/jobs';
import { VpnService } from './services/VpnService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (Nginx/DigitalOcean ke liye zaroori)
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet());
app.use(cors());

// Rate Limiting - Testing ke liye relaxed
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use('/avatars', express.static(path.join(__dirname, '../public/avatars')));

// API Routes
app.use('/api', apiRoutes);

// Initialize Cron Jobs
initCronJobs();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const startServer = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('PostgreSQL Connected');
    await connectRedis();
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
      // VpnService.startMonitoring(); // Temporarily disabled for local dev
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();