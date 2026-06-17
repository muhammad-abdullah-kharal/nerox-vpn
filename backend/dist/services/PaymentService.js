"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const db_1 = __importDefault(require("../config/db"));
class PaymentService {
    static async verifyPurchase(userId, platform, productId, purchaseToken) {
        // In a real production setup, you would call Google/Apple APIs here.
        // For now, we mock the validation as the original code did.
        console.log(`Verifying ${platform} purchase for user ${userId}: ${purchaseToken}`);
        const isValid = true; // Placeholder for actual verification logic
        if (!isValid) {
            throw new Error('Invalid payment token');
        }
        // Database Update
        const client = await db_1.default.connect();
        try {
            await client.query('BEGIN');
            // Fetch plan details
            const planRes = await client.query(`SELECT * FROM subscription_plans WHERE ${platform === 'android' ? 'google_product_id' : 'apple_product_id'} = $1`, [productId]);
            if (planRes.rows.length === 0) {
                throw new Error('Plan not found');
            }
            const plan = planRes.rows[0];
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(startDate.getMonth() + plan.duration_months);
            // Create/Update Subscription
            const subRes = await client.query(`INSERT INTO subscriptions (user_id, plan_id, start_date, end_date, status, payment_method)
         VALUES ($1, $2, $3, $4, 'active', $5)
         ON CONFLICT (user_id) DO UPDATE 
         SET plan_id = EXCLUDED.plan_id, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, status = 'active'
         RETURNING subscription_id`, [userId, plan.plan_id, startDate, endDate, platform === 'android' ? 'Google Play' : 'Apple IAP']);
            const subscriptionId = subRes.rows[0].subscription_id;
            // Log Transaction
            await client.query(`INSERT INTO payment_transactions (subscription_id, amount, status, processed_at, platform, purchase_token)
         VALUES ($1, $2, 'completed', NOW(), $3, $4)`, [subscriptionId, plan.price_usd, platform, purchaseToken]);
            await client.query('COMMIT');
            return { success: true, message: 'Subscription activated!' };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
}
exports.PaymentService = PaymentService;
