import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService } from '../services/AuthService';

export class AuthController {

  // POST /api/auth/register
  static async register(req: Request, res: Response) {
    try {
      const { email, password, username, deviceInfo, referralCode } = req.body;

      if (!email || !password || !username) {
        return res.status(400).json({ error: 'Email, username, and password are required.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      const result = await AuthService.register(email.toLowerCase().trim(), password, username.trim(), referralCode);

      if (result.requireVerification) {
        return res.json({ success: true, requireVerification: true, email: result.email });
      }

      // Extract userId from token (if we ever revert to auto-login)
      const decoded: any = jwt.decode(result);
      if (decoded?.userId) {
        await AuthService.registerDevice(decoded.userId, deviceInfo);
      }

      res.json({ success: true, token: result });

    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // POST /api/auth/login
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const result = await AuthService.login(email.toLowerCase().trim(), password);

      if (result.requireVerification) {
        res.json({ success: true, requireVerification: true, email: result.email });
      } else {
        res.json({ success: true, token: result.token });
      }
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  // POST /api/auth/social
  static async socialLogin(req: Request, res: Response) {
    try {
      const { provider, idToken, identityToken, nonce, user, deviceInfo } = req.body;

      if (provider !== 'google' && provider !== 'apple') {
        return res.status(400).json({ error: 'Provider must be google or apple.' });
      }

      const token = provider === 'google' ? idToken : identityToken || idToken;
      if (!token) {
        return res.status(400).json({ error: 'Identity token is required.' });
      }

      const result = await AuthService.socialLogin(
        provider,
        token,
        user,
        nonce,
        deviceInfo,
      );

      res.json({
        success: true,
        token: result.token,
        isNewUser: result.isNewUser,
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  // POST /api/auth/send-otp
  static async sendOtp(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required.' });

      const result = await AuthService.sendOtp(email.toLowerCase().trim());
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // POST /api/auth/verify-otp
  static async verifyOtp(req: Request, res: Response) {
    try {
      const { email, code } = req.body;
      if (!email || !code) return res.status(400).json({ error: 'Email and code are required.' });

      const token = await AuthService.verifyOtp(email.toLowerCase().trim(), code);
      res.json({ success: true, token });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // POST /api/auth/reset-password
  static async resetPassword(req: Request, res: Response) {
    try {
      const { password } = req.body;
      const user = (req as any).user;

      if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      }

      await AuthService.resetPassword(user.userId, password);
      res.json({ success: true, message: 'Password reset successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
