"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FaqController = void 0;
const db_1 = __importDefault(require("../config/db"));
class FaqController {
    static async getCategories(req, res) {
        try {
            console.log(`[FaqController] getCategories requested by ${req.ip}`);
            const { rows } = await db_1.default.query('SELECT * FROM faq_categories ORDER BY sort_order ASC');
            console.log(`[FaqController] Returning ${rows.length} categories`);
            res.json(rows);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async getFaqsByCategory(req, res) {
        try {
            const { categoryId } = req.params;
            console.log(`[FaqController] getFaqsByCategory requested for ID: ${categoryId}`);
            const { rows } = await db_1.default.query('SELECT f.*, c.name as category_name FROM faqs f JOIN faq_categories c ON f.category_id = c.id WHERE f.category_id = $1 ORDER BY f.sort_order ASC', [categoryId]);
            console.log(`[FaqController] Returning ${rows.length} FAQs`);
            res.json(rows);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async searchFaqs(req, res) {
        try {
            const { query } = req.query;
            if (!query)
                return res.status(400).json({ error: 'Query is required' });
            const { rows } = await db_1.default.query(`SELECT f.*, c.name as category_name 
         FROM faqs f 
         JOIN faq_categories c ON f.category_id = c.id 
         WHERE f.question ILIKE $1 OR f.answer_text_1 ILIKE $1 OR c.name ILIKE $1 
         ORDER BY f.sort_order ASC 
         LIMIT 20`, [`%${query}%`]);
            res.json(rows);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.FaqController = FaqController;
