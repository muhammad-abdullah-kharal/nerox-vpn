"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const db_1 = __importDefault(require("../config/db"));
class AdminController {
    static async getDashboardStats(req, res) {
        try {
            // Fetch high level metrics for the admin dashboard
            const userCountRes = await db_1.default.query('SELECT COUNT(*) FROM users');
            const premiumCountRes = await db_1.default.query('SELECT COUNT(*) FROM subscription_plans WHERE is_custom = false'); // Example
            const serverCountRes = await db_1.default.query('SELECT COUNT(*) FROM vpn_servers');
            const stats = {
                totalUsers: parseInt(userCountRes.rows[0].count),
                premiumUsers: parseInt(premiumCountRes.rows[0].count),
                totalServers: parseInt(serverCountRes.rows[0].count),
                revenue: 0 // Fetch from payments
            };
            res.json(stats);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async getUsers(req, res) {
        try {
            const { rows } = await db_1.default.query('SELECT user_id, email, display_name, plan_type, created_at FROM users ORDER BY created_at DESC LIMIT 50');
            res.json(rows);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async getServers(req, res) {
        try {
            const { rows } = await db_1.default.query('SELECT server_id, location, country_code, ip_address, is_premium, status FROM vpn_servers ORDER BY created_at DESC');
            res.json(rows);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.AdminController = AdminController;
