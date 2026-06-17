import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/db';
import fs from 'fs';
import path from 'path';

export class UserController {
  static async getProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { rows } = await pool.query(
        `SELECT user_id, username, email, role, plan_type, trial_ends_at, 
                subscription_end_date, daily_data_limit_bytes, daily_data_used_bytes,
                last_data_reset_at, avatar_url, display_name, referral_code, created_at,
                max_devices, authorized_regions 
         FROM users WHERE user_id = $1`,
        [userId]
      );

      if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
      const user = rows[0];

      // ✅ Auto-reset daily data usage every 24 hours
      const lastReset = user.last_data_reset_at ? new Date(user.last_data_reset_at) : new Date(0);
      const hoursSinceReset = (Date.now() - lastReset.getTime()) / (1000 * 60 * 60);

      if (hoursSinceReset >= 24 && parseInt(user.daily_data_used_bytes) > 0) {
        await pool.query(
          `UPDATE users 
           SET daily_data_used_bytes = 0, last_data_reset_at = NOW() 
           WHERE user_id = $1`,
          [userId]
        );
        user.daily_data_used_bytes = 0;
        user.last_data_reset_at = new Date();
        console.log(`[DailyReset] Reset daily usage for user ${userId} after ${hoursSinceReset.toFixed(1)}h`);
      }

      // Fetch active devices
      const devicesRes = await pool.query(
        'SELECT device_id, model, os, last_active_at FROM user_devices WHERE user_id = $1 ORDER BY last_active_at DESC',
        [userId]
      );
      user.devices = devicesRes.rows;

      // Fetch active plan id
      const subRes = await pool.query(
        'SELECT plan_id FROM subscriptions WHERE user_id = $1 AND status = $2 ORDER BY start_date DESC LIMIT 1',
        [userId, 'active']
      );
      if (subRes.rows.length > 0) {
        user.active_plan_id = subRes.rows[0].plan_id;
      }

      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { displayName } = req.body;
      
      await pool.query(
        'UPDATE users SET display_name = $1, updated_at = NOW() WHERE user_id = $2',
        [displayName, userId]
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getUsageStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { rows } = await pool.query(
        `SELECT 
            COUNT(vs.session_id) as total_sessions,
            COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(vs.end_time, NOW()) - vs.created_at))/60), 0) as total_active_minutes,
            COALESCE((SELECT SUM(bytes_sent) FROM vpn_traffic_stats ts JOIN vpn_sessions s ON ts.session_id = s.session_id WHERE s.user_id = $1), 0) as total_upload,
            COALESCE((SELECT SUM(bytes_received) FROM vpn_traffic_stats ts JOIN vpn_sessions s ON ts.session_id = s.session_id WHERE s.user_id = $1), 0) as total_download
         FROM vpn_sessions vs
         WHERE vs.user_id = $1`,
        [userId]
      );
      res.json(rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async uploadAvatar(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { base64, fileName, type } = req.body;

      if (!base64 || !userId) return res.status(400).json({ error: 'Invalid data' });

      // In a real production app, we would upload to S3/Cloudinary.
      // For this migration, we'll simulate a local storage save and return a public URL.
      const buffer = Buffer.from(base64, 'base64');
      const dir = path.join(__dirname, '../../public/avatars');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const safeFileName = `${userId}-${Date.now()}-${fileName}`;
      const filePath = path.join(dir, safeFileName);
      fs.writeFileSync(filePath, buffer);

      const publicUrl = `${process.env.APP_URL || 'http://localhost:3000'}/avatars/${safeFileName}`;
      
      await pool.query(
        'UPDATE users SET avatar_url = $1 WHERE user_id = $2',
        [publicUrl, userId]
      );

      res.json({ success: true, avatarUrl: publicUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
