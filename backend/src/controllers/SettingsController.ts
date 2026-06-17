import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/db';

export class SettingsController {
  static async getSplitTunnelingConfig(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { rows } = await pool.query('SELECT split_tunneling_config FROM users WHERE user_id = $1', [userId]);
      res.json(rows[0]?.split_tunneling_config || {});
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async setSplitTunnelingConfig(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { config } = req.body;
      await pool.query('UPDATE users SET split_tunneling_config = $1 WHERE user_id = $2', [config, userId]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getPreferredProtocol(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { rows } = await pool.query('SELECT preferred_protocol FROM users WHERE user_id = $1', [userId]);
      res.json({ protocol: rows[0]?.preferred_protocol || 'Auto' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async setPreferredProtocol(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { protocol } = req.body;
      await pool.query('UPDATE users SET preferred_protocol = $1 WHERE user_id = $2', [protocol, userId]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getKillSwitchConfig(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { rows } = await pool.query('SELECT kill_switch_enabled FROM users WHERE user_id = $1', [userId]);
      res.json({ enabled: rows[0]?.kill_switch_enabled || false });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async setKillSwitchConfig(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { enabled } = req.body;
      await pool.query('UPDATE users SET kill_switch_enabled = $1 WHERE user_id = $2', [enabled, userId]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
