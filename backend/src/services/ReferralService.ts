  import pool from '../config/db';
const { v4: uuidv4 } = require('uuid');

export class ReferralService {
  /**
   * Generates a unique referral code for a user if they don't have one
   */
  static async ensureReferralCode(userId: string) {
    const { rows } = await pool.query('SELECT referral_code FROM users WHERE user_id = $1', [userId]);
    if (rows[0]?.referral_code) return rows[0].referral_code;

    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await pool.query('UPDATE users SET referral_code = $1 WHERE user_id = $2', [newCode, userId]);
    return newCode;
  }

  /**
   * Ported from PLpgSQL: apply_referral
   * Validates code and grants rewards to both referrer and referee
   */
  static async applyReferral(refereeId: string, code: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Find referrer
      const referrerRes = await client.query(
        'SELECT user_id, email FROM users WHERE referral_code = $1',
        [code]
      );
      if (referrerRes.rows.length === 0) throw new Error('Invalid referral code');
      
      const referrerId = referrerRes.rows[0].user_id;
      if (referrerId === refereeId) throw new Error('You cannot refer yourself');

      // 2. Check if referee already used a code
      const usageRes = await client.query(
        'SELECT 1 FROM referral_usage WHERE referee_id = $1',
        [refereeId]
      );
      if (usageRes.rows.length > 0) throw new Error('You have already used a referral code');

      // 3. Grant rewards (e.g., 3 days of premium trial to both)
      const trialDays = 3;
      
      // Update Referrer
      await client.query(
        `UPDATE users 
         SET trial_ends_at = GREATEST(COALESCE(trial_ends_at, NOW()), NOW()) + ($1 || ' days')::interval
         WHERE user_id = $2`,
        [trialDays, referrerId]
      );

      // Update Referee
      await client.query(
        `UPDATE users 
         SET trial_ends_at = GREATEST(COALESCE(trial_ends_at, NOW()), NOW()) + ($1 || ' days')::interval
         WHERE user_id = $2`,
        [trialDays, refereeId]
      );

      // 4. Log usage
      await client.query(
        'INSERT INTO referral_usage (referrer_id, referee_id, referral_code) VALUES ($1, $2, $3)',
        [referrerId, refereeId, code]
      );

      await client.query('COMMIT');
      return { success: true, message: `Successfully applied! You both got ${trialDays} extra trial days.` };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getReferralStats(userId: string) {
    const { rows } = await pool.query(
      `SELECT count(*)::int as total_referrals, 
       COALESCE(sum(reward_days), 0)::int as total_days_earned
       FROM referral_usage WHERE referrer_id = $1`,
      [userId]
    );
    return rows[0];
  }
}
