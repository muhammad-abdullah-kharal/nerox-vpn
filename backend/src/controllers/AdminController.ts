import { Request, Response } from 'express';
import pool from '../config/db';

export class AdminController {
  
  static async getDashboardStats(req: Request, res: Response) {
    try {
      // Fetch high level metrics for the admin dashboard
      const userCountRes = await pool.query('SELECT COUNT(*) FROM users');
      const premiumCountRes = await pool.query('SELECT COUNT(*) FROM subscription_plans WHERE is_custom = false'); // Example
      const serverCountRes = await pool.query('SELECT COUNT(*) FROM vpn_servers');
      
      const stats = {
        totalUsers: parseInt(userCountRes.rows[0].count),
        premiumUsers: parseInt(premiumCountRes.rows[0].count),
        totalServers: parseInt(serverCountRes.rows[0].count),
        revenue: 0 // Fetch from payments
      };

      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getUsers(req: Request, res: Response) {
    try {
      const { rows } = await pool.query('SELECT user_id, email, display_name, plan_type, created_at FROM users ORDER BY created_at DESC LIMIT 50');
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getServers(req: Request, res: Response) {
    try {
      const { rows } = await pool.query('SELECT server_id, location, country_code, ip_address, is_premium, status FROM vpn_servers ORDER BY created_at DESC');
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
