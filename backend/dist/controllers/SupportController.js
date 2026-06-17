"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportController = void 0;
const db_1 = __importDefault(require("../config/db"));
class SupportController {
    static async submitFeedback(req, res) {
        try {
            const { category, subject, message } = req.body;
            const userId = req.user?.userId;
            if (!message || !userId)
                return res.status(400).json({ error: 'Message is required' });
            await db_1.default.query('INSERT INTO support_feedback (user_id, category, subject, message) VALUES ($1, $2, $3, $4)', [userId, category, subject, message]);
            res.json({ success: true, message: 'Feedback submitted successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async getFeedbackHistory(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return res.status(401).json({ error: 'Unauthorized' });
            const { rows } = await db_1.default.query('SELECT * FROM support_feedback WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
            res.json(rows);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async respondToFeedback(req, res) {
        try {
            const { id } = req.params;
            const { response, status } = req.body;
            const isAdmin = req.user?.role === 'admin';
            if (!isAdmin)
                return res.status(403).json({ error: 'Only admins can respond to feedback' });
            if (!response)
                return res.status(400).json({ error: 'Response message is required' });
            await db_1.default.query('UPDATE support_feedback SET admin_response = $1, status = $2 WHERE id = $3', [response, status || 'resolved', id]);
            res.json({ success: true, message: 'Response recorded successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.SupportController = SupportController;
