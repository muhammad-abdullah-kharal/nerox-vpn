import { Request, Response } from 'express';
import pool from '../config/db';

export class FaqController {
  static async getCategories(req: Request, res: Response) {
    try {
      console.log(`[FaqController] getCategories requested by ${req.ip}`);
      const { rows } = await pool.query('SELECT * FROM faq_categories ORDER BY sort_order ASC');
      console.log(`[FaqController] Returning ${rows.length} categories`);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getFaqsByCategory(req: Request, res: Response) {
    try {
      const { categoryId } = req.params;
      console.log(`[FaqController] getFaqsByCategory requested for ID: ${categoryId}`);
      const { rows } = await pool.query(
        'SELECT f.*, c.name as category_name FROM faqs f JOIN faq_categories c ON f.category_id = c.id WHERE f.category_id = $1 ORDER BY f.sort_order ASC',
        [categoryId]
      );
      console.log(`[FaqController] Returning ${rows.length} FAQs`);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async searchFaqs(req: Request, res: Response) {
    try {
      const { query } = req.query;
      if (!query) return res.status(400).json({ error: 'Query is required' });

      const { rows } = await pool.query(
        `SELECT f.*, c.name as category_name 
         FROM faqs f 
         JOIN faq_categories c ON f.category_id = c.id 
         WHERE f.question ILIKE $1 OR f.answer_text_1 ILIKE $1 OR c.name ILIKE $1 
         ORDER BY f.sort_order ASC 
         LIMIT 20`,
        [`%${query}%`]
      );
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
