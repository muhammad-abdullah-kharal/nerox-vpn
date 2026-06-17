import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ReferralService } from '../services/ReferralService';

export class ReferralController {
  static async getCode(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      
      const code = await ReferralService.ensureReferralCode(userId);
      const stats = await ReferralService.getReferralStats(userId);
      
      res.json({ code, ...stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async applyCode(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { code } = req.body;
      if (!userId || !code) return res.status(400).json({ error: 'Code is required' });
      
      const result = await ReferralService.applyReferral(userId, code);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
