"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const AuthService_1 = require("../services/AuthService");
class AuthController {
    // POST /api/auth/register
    static async register(req, res) {
        try {
            const { email, password, username, deviceInfo, referralCode } = req.body;
            if (!email || !password || !username) {
                return res.status(400).json({ error: 'Email, username, and password are required.' });
            }
            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters.' });
            }
            const result = await AuthService_1.AuthService.register(email.toLowerCase().trim(), password, username.trim(), referralCode);
            if (result.requireVerification) {
                return res.json({ success: true, requireVerification: true, email: result.email });
            }
            // Extract userId from token (if we ever revert to auto-login)
            const decoded = jsonwebtoken_1.default.decode(result);
            if (decoded?.userId) {
                await AuthService_1.AuthService.registerDevice(decoded.userId, deviceInfo);
            }
            res.json({ success: true, token: result });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    // POST /api/auth/login
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required.' });
            }
            const result = await AuthService_1.AuthService.login(email.toLowerCase().trim(), password);
            if (result.requireVerification) {
                res.json({ success: true, requireVerification: true, email: result.email });
            }
            else {
                res.json({ success: true, token: result.token });
            }
        }
        catch (error) {
            res.status(401).json({ error: error.message });
        }
    }
    // POST /api/auth/send-otp
    static async sendOtp(req, res) {
        try {
            const { email } = req.body;
            if (!email)
                return res.status(400).json({ error: 'Email is required.' });
            const result = await AuthService_1.AuthService.sendOtp(email.toLowerCase().trim());
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    // POST /api/auth/verify-otp
    static async verifyOtp(req, res) {
        try {
            const { email, code } = req.body;
            if (!email || !code)
                return res.status(400).json({ error: 'Email and code are required.' });
            const token = await AuthService_1.AuthService.verifyOtp(email.toLowerCase().trim(), code);
            res.json({ success: true, token });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    // POST /api/auth/reset-password
    static async resetPassword(req, res) {
        try {
            const { password } = req.body;
            const user = req.user;
            if (!password || password.length < 8) {
                return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
            }
            await AuthService_1.AuthService.resetPassword(user.userId, password);
            res.json({ success: true, message: 'Password reset successfully' });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}
exports.AuthController = AuthController;
