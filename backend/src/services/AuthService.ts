import pool from '../config/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const sendResendEmail = async (to: string, subject: string, text: string) => {
  const apiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@neroxvpn.com';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `Nerox VPN <${from}>`,
      to: [to],
      subject,
      text
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API Error: ${response.status} ${errorBody}`);
  }
};

export class AuthService {

  // ─── Register (Sign Up) ───────────────────────────────────────────────
  static async register(email: string, password: string, username: string, referralCodeApplied?: string): Promise<any> {
    // Check if email already exists
    const existing = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new Error('An account with this email already exists.');
    }

    const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const passwordHash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash, plan_type, trial_ends_at, referral_code, is_verified, verification_code, verification_expires_at)
       VALUES ($1, $2, $3, 'free', NOW() + INTERVAL '7 days', $4, false, $5, NOW() + INTERVAL '15 minutes')
       RETURNING user_id, role, email`,
      [username, email, passwordHash, referralCode, verificationCode]
    );

    const user = rows[0];

    // Handle incoming referral code
    if (referralCodeApplied) {
      try {
        const { ReferralService } = require('./ReferralService');
        await ReferralService.applyReferral(user.user_id, referralCodeApplied);
      } catch (err) {
        console.warn(`[AuthService] Could not apply referral code ${referralCodeApplied}:`, err);
        // We don't block registration if referral fails
      }
    }

    try {
      await sendResendEmail(
        email,
        'Verify your Nerox VPN Account',
        `Your verification code is: ${verificationCode}\n\nIt expires in 15 minutes.`
      );
    } catch (err) {
      console.warn('[AuthService] Failed to send verification email', err);
    }

    return { requireVerification: true, email: user.email };
  }

  // ─── Login (Sign In) ──────────────────────────────────────────────────
  static async login(email: string, passwordRaw: string): Promise<any> {
    const { rows } = await pool.query(
      'SELECT user_id, password_hash, is_verified, locked_until, role FROM users WHERE email = $1',
      [email]
    );

    if (rows.length === 0) {
      throw new Error('No account found with this email.');
    }

    const user = rows[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      throw new Error(`Account is locked due to too many failed attempts. Try again in ${remainingMinutes} minutes.`);
    }

    const isValid = await bcrypt.compare(passwordRaw, user.password_hash);
    if (!isValid) {
      // Logic to increment failed attempts could go here
      throw new Error('Invalid email or password.');
    }

    if (!user.is_verified) {
      // Send an OTP and require verification before letting them login fully
      await this.sendOtp(email);
      return { requireVerification: true, email };
    }

    // Fully verified and correct password, generate token
    const token = jwt.sign(
      { userId: user.user_id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );
    
    return { token };
  }

  static async sendOtp(email: string): Promise<any> {
    const { rows } = await pool.query('SELECT user_id, is_verified FROM users WHERE email = $1', [email]);
    if (rows.length === 0) throw new Error('No account found with this email.');
    const user = rows[0];

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    await pool.query(
      `UPDATE users SET verification_code = $1, verification_expires_at = NOW() + INTERVAL '15 minutes' WHERE user_id = $2`,
      [verificationCode, user.user_id]
    );

    try {
      await sendResendEmail(
        email,
        'Verify your Nerox VPN Account',
        `Your verification code is: ${verificationCode}\n\nIt expires in 15 minutes.`
      );
    } catch (err) {
      console.warn('Failed to send verification email', err);
      throw new Error('Failed to send verification email. Please try again or check your SMTP configuration.');
    }

    return { success: true, requireVerification: true };
  }

  static async verifyOtp(email: string, code: string): Promise<any> {
    const { rows } = await pool.query(
      'SELECT user_id, verification_code, verification_expires_at, role FROM users WHERE email = $1',
      [email]
    );

    if (rows.length === 0) throw new Error('No account found with this email.');
    const user = rows[0];

    if (!user.verification_code || user.verification_code !== code) {
      throw new Error('Invalid verification code.');
    }

    if (new Date(user.verification_expires_at) < new Date()) {
      throw new Error('Verification code has expired. Please request a new one.');
    }

    await pool.query(
      'UPDATE users SET is_verified = true, verification_code = NULL, verification_expires_at = NULL WHERE user_id = $1',
      [user.user_id]
    );

    return jwt.sign(
      { userId: user.user_id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );
  }

  static async resetPassword(userId: string, newPasswordRaw: string): Promise<void> {
    const newPasswordHash = await bcrypt.hash(newPasswordRaw, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, failed_attempts = 0, locked_until = NULL WHERE user_id = $2',
      [newPasswordHash, userId]
    );
  }

  static async registerDevice(userId: string, deviceInfo: { deviceId: string, model: string, os: string }) {
    if (!deviceInfo || !deviceInfo.deviceId) return;
    
    await pool.query(
      `INSERT INTO user_devices (user_id, device_id, model, os, last_active_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, device_id) DO UPDATE SET 
         model = EXCLUDED.model, 
         os = EXCLUDED.os, 
         last_active_at = NOW()`,
      [userId, deviceInfo.deviceId, deviceInfo.model, deviceInfo.os]
    );
  }
}
