import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/db';

export class SupportController {
  static async submitFeedback(req: AuthRequest, res: Response) {
    try {
      const { category, subject, message } = req.body;
      const userId = req.user?.userId;

      if (!message || !userId) return res.status(400).json({ error: 'Message is required' });

      await pool.query(
        'INSERT INTO support_feedback (user_id, category, subject, message) VALUES ($1, $2, $3, $4)',
        [userId, category, subject, message]
      );

      res.json({ success: true, message: 'Feedback submitted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getFeedbackHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { rows } = await pool.query(
        'SELECT * FROM support_feedback WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async respondToFeedback(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { response, status } = req.body;
      const isAdmin = req.user?.role === 'admin';

      if (!isAdmin) return res.status(403).json({ error: 'Only admins can respond to feedback' });
      if (!response) return res.status(400).json({ error: 'Response message is required' });

      await pool.query(
        'UPDATE support_feedback SET admin_response = $1, status = $2 WHERE id = $3',
        [response, status || 'resolved', id]
      );

      res.json({ success: true, message: 'Response recorded successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
