"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsController = void 0;
const db_1 = __importDefault(require("../config/db"));
class SettingsController {
    static async getSplitTunnelingConfig(req, res) {
        try {
            const userId = req.user?.userId;
            const { rows } = await db_1.default.query('SELECT split_tunneling_config FROM users WHERE user_id = $1', [userId]);
            res.json(rows[0]?.split_tunneling_config || {});
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async setSplitTunnelingConfig(req, res) {
        try {
            const userId = req.user?.userId;
            const { config } = req.body;
            await db_1.default.query('UPDATE users SET split_tunneling_config = $1 WHERE user_id = $2', [config, userId]);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async getPreferredProtocol(req, res) {
        try {
            const userId = req.user?.userId;
            const { rows } = await db_1.default.query('SELECT preferred_protocol FROM users WHERE user_id = $1', [userId]);
            res.json({ protocol: rows[0]?.preferred_protocol || 'Auto' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async setPreferredProtocol(req, res) {
        try {
            const userId = req.user?.userId;
            const { protocol } = req.body;
            await db_1.default.query('UPDATE users SET preferred_protocol = $1 WHERE user_id = $2', [protocol, userId]);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async getKillSwitchConfig(req, res) {
        try {
            const userId = req.user?.userId;
            const { rows } = await db_1.default.query('SELECT kill_switch_enabled FROM users WHERE user_id = $1', [userId]);
            res.json({ enabled: rows[0]?.kill_switch_enabled || false });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async setKillSwitchConfig(req, res) {
        try {
            const userId = req.user?.userId;
            const { enabled } = req.body;
            await db_1.default.query('UPDATE users SET kill_switch_enabled = $1 WHERE user_id = $2', [enabled, userId]);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.SettingsController = SettingsController;
