"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const db_1 = __importDefault(require("../config/db"));
const SubscriptionService_1 = require("../services/SubscriptionService");
class PaymentController {
    static async getPlans(req, res) {
        try {
            const { rows } = await db_1.default.query('SELECT * FROM subscription_plans ORDER BY price_usd ASC');
            res.json(rows);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async calculateCustomPrice(req, res) {
        try {
            const duration = parseFloat(req.query.duration) || 1;
            const devices = parseInt(req.query.devices) || 1;
            const result = SubscriptionService_1.SubscriptionService.calculateCustomPrice(duration, devices);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async verifyPurchase(req, res) {
        try {
            const { platform, productId, purchaseToken } = req.body;
            const userId = req.user?.userId;
            if (!userId)
                return res.status(401).json({ error: 'Unauthorized' });
            if (!platform || !productId || !purchaseToken) {
                return res.status(400).json({ error: 'Platform, Product ID, and Purchase Token are required' });
            }
            // 1. Double-Redemption Protection (Idempotency)
            const existingTx = await db_1.default.query('SELECT transaction_id FROM payment_transactions WHERE purchase_token = $1', [purchaseToken]);
            if (existingTx.rows.length > 0) {
                return res.status(400).json({ error: 'This transaction has already been processed' });
            }
            // 2. Platform-Specific Verification (Simulated)
            let isVerified = false;
            if (platform === 'google') {
                isVerified = await PaymentController.verifyWithGoogle(productId, purchaseToken);
            }
            else if (platform === 'apple') {
                isVerified = await PaymentController.verifyWithApple(productId, purchaseToken);
            }
            else {
                return res.status(400).json({ error: 'Unsupported platform' });
            }
            if (!isVerified) {
                return res.status(400).json({ error: 'Payment verification failed' });
            }
            // 3. Process Subscription Update
            const planRes = await db_1.default.query('SELECT * FROM subscription_plans WHERE google_product_id = $1 OR apple_product_id = $1 OR name = $1', [productId]);
            if (planRes.rows.length === 0)
                return res.status(400).json({ error: 'Invalid product' });
            const plan = planRes.rows[0];
            const durationMonths = plan.duration_months || 1;
            const expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
            const client = await db_1.default.connect();
            try {
                await client.query('BEGIN');
                // Record Transaction
                await client.query(`INSERT INTO payment_transactions (user_id, platform, product_id, purchase_token, status, amount, amount_paid)
           VALUES ($1, $2, $3, $4, 'completed', $5, $5)`, [userId, platform, productId, purchaseToken, plan.price_usd]);
                // Update User
                await client.query(`UPDATE users SET 
            plan_type = 'premium', 
            subscription_end_date = $1,
            max_devices = $2
           WHERE user_id = $3`, [expiryDate, plan.max_devices || 5, userId]);
                // Create/Update Subscription Record
                await client.query(`INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date)
           VALUES ($1, $2, 'active', NOW(), $3)
           ON CONFLICT (user_id) DO UPDATE SET 
            plan_id = EXCLUDED.plan_id,
            status = EXCLUDED.status,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date`, [userId, plan.plan_id, expiryDate]);
                await client.query('COMMIT');
                res.json({ success: true, message: 'Purchase verified and applied' });
            }
            catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            console.error('[Payment] Verification error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    // ✅ Mock purchase endpoint — upgrades plan by plan_id directly.
    // Used during development before real store product IDs are configured.
    static async mockPurchase(req, res) {
        try {
            const { planId, customDuration, customDevices, customRegion } = req.body;
            const userId = req.user?.userId;
            if (!userId)
                return res.status(401).json({ error: 'Unauthorized' });
            if (!planId)
                return res.status(400).json({ error: 'planId is required' });
            const planRes = await db_1.default.query('SELECT * FROM subscription_plans WHERE plan_id = $1', [planId]);
            if (planRes.rows.length === 0)
                return res.status(404).json({ error: 'Plan not found' });
            const plan = planRes.rows[0];
            const isFree = parseFloat(plan.price_usd) === 0;
            let durationMonths = 1;
            if (customDuration) {
                const durStr = customDuration.toString();
                if (durStr === '1w')
                    durationMonths = 0.25;
                else if (durStr === '3m')
                    durationMonths = 3;
                else if (durStr === '12m')
                    durationMonths = 12;
                else
                    durationMonths = parseFloat(durStr) || 1;
            }
            else {
                durationMonths = parseFloat(plan.duration_months) || 1;
            }
            const devices = parseInt((customDevices || plan.max_devices || 5));
            // Map custom regions to country codes
            let authorizedRegions = ['Global'];
            if (customRegion === 'US Only')
                authorizedRegions = ['US'];
            else if (customRegion === 'Europe')
                authorizedRegions = ['GB', 'DE', 'FR', 'NL', 'SE'];
            else if (customRegion === 'Global')
                authorizedRegions = ['Global'];
            const expiryDate = new Date();
            if (!isFree) {
                const totalDays = Math.ceil(durationMonths * 30.44);
                expiryDate.setDate(expiryDate.getDate() + totalDays);
            }
            const client = await db_1.default.connect();
            try {
                await client.query('BEGIN');
                await client.query(`UPDATE users SET 
            plan_type = $1, 
            subscription_end_date = $2,
            max_devices = $3,
            authorized_regions = $4
           WHERE user_id = $5`, [isFree ? 'free' : 'premium', isFree ? null : expiryDate, devices, authorizedRegions, userId]);
                if (!isFree) {
                    await client.query(`INSERT INTO payment_transactions (user_id, platform, product_id, purchase_token, status, amount, amount_paid)
             VALUES ($1, 'mock', $2, $3, 'completed', $4, $4)`, [userId, plan.plan_id, `mock_${Date.now()}`, plan.price_usd]);
                    // Create/Update Subscription Record
                    await client.query(`INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date)
             VALUES ($1, $2, 'active', NOW(), $3)
             ON CONFLICT (user_id) DO UPDATE SET 
              plan_id = EXCLUDED.plan_id,
              status = EXCLUDED.status,
              start_date = EXCLUDED.start_date,
              end_date = EXCLUDED.end_date`, [userId, plan.plan_id, expiryDate]);
                }
                await client.query('COMMIT');
                res.json({ success: true, message: `${plan.name} plan activated!`, plan });
            }
            catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            console.error('[Payment] Mock purchase error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    static async verifyWithGoogle(productId, token) {
        console.log(`[GooglePlay] Verifying token ${token.substring(0, 10)}...`);
        return true;
    }
    static async verifyWithApple(productId, token) {
        console.log(`[AppStore] Verifying receipt ${token.substring(0, 10)}...`);
        return true;
    }
    // ✅ Initialize Flutterwave Payment
    static async initializePayment(req, res) {
        try {
            const { planId } = req.body;
            const userId = req.user?.userId;
            if (!userId)
                return res.status(401).json({ error: 'Unauthorized' });
            if (!planId)
                return res.status(400).json({ error: 'planId is required' });
            // Get plan details
            const planRes = await db_1.default.query('SELECT * FROM subscription_plans WHERE plan_id = $1', [planId]);
            if (planRes.rows.length === 0)
                return res.status(404).json({ error: 'Plan not found' });
            const plan = planRes.rows[0];
            // Get user email
            const userRes = await db_1.default.query('SELECT email FROM users WHERE user_id = $1', [userId]);
            if (userRes.rows.length === 0)
                return res.status(404).json({ error: 'User not found' });
            const userEmail = userRes.rows[0].email;
            // Generate a unique transaction reference
            const txRef = `tx-${userId}-${planId}-${Date.now()}`;
            // Insert an initial pending transaction
            await db_1.default.query(`INSERT INTO payment_transactions (user_id, platform, product_id, purchase_token, status, amount, amount_paid)
         VALUES ($1, 'flutterwave', $2, $3, 'pending', $4, 0)`, [userId, plan.plan_id, txRef, plan.price_usd]);
            // Return initialization parameters to the mobile app
            res.json({
                success: true,
                data: {
                    txRef,
                    amount: parseFloat(plan.price_usd),
                    currency: 'USD',
                    paymentOptions: 'card, banktransfer, ussd',
                    customerEmail: userEmail,
                    publicKey: process.env.FLW_PUBLIC_KEY,
                    planName: plan.name,
                }
            });
        }
        catch (error) {
            console.error('[Payment] Initialize error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    // ✅ Handle Flutterwave Webhook
    static async handleWebhook(req, res) {
        try {
            // 1. Verify webhook signature
            const secretHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
            const signature = req.headers['verif-hash'];
            if (!signature || signature !== secretHash) {
                return res.status(401).send('Unauthorized webhook signature');
            }
            const payload = req.body;
            // 2. Acknowledge receipt to Flutterwave immediately
            res.status(200).send('Webhook received');
            if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
                const txRef = payload.data.tx_ref;
                const amountPaid = payload.data.amount;
                // Find the pending transaction
                const txRes = await db_1.default.query('SELECT * FROM payment_transactions WHERE purchase_token = $1 AND status = \'pending\'', [txRef]);
                if (txRes.rows.length === 0) {
                    // Transaction already processed or not found
                    console.log(`[Webhook] Transaction ${txRef} already processed or not found`);
                    return;
                }
                const tx = txRes.rows[0];
                const userId = tx.user_id;
                const planId = tx.product_id;
                const planRes = await db_1.default.query('SELECT * FROM subscription_plans WHERE plan_id = $1', [planId]);
                const plan = planRes.rows[0];
                if (!plan)
                    return;
                const durationMonths = parseFloat(plan.duration_months) || 1;
                const devices = plan.max_devices || 5;
                const expiryDate = new Date();
                const totalDays = Math.ceil(durationMonths * 30.44);
                expiryDate.setDate(expiryDate.getDate() + totalDays);
                const client = await db_1.default.connect();
                try {
                    await client.query('BEGIN');
                    // Update Transaction
                    await client.query(`UPDATE payment_transactions 
             SET status = 'completed', amount_paid = $1 
             WHERE transaction_id = $2`, [amountPaid, tx.transaction_id]);
                    // Update User
                    await client.query(`UPDATE users SET 
              plan_type = 'premium', 
              subscription_end_date = $1,
              max_devices = $2,
              authorized_regions = ARRAY['Global']::text[]
             WHERE user_id = $3`, [expiryDate, devices, userId]);
                    // Update Subscription
                    await client.query(`INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date)
             VALUES ($1, $2, 'active', NOW(), $3)
             ON CONFLICT (user_id) DO UPDATE SET 
              plan_id = EXCLUDED.plan_id,
              status = EXCLUDED.status,
              start_date = EXCLUDED.start_date,
              end_date = EXCLUDED.end_date`, [userId, plan.plan_id, expiryDate]);
                    await client.query('COMMIT');
                    console.log(`[Webhook] Successfully processed ${txRef}`);
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
        catch (error) {
            console.error('[Payment] Webhook error:', error);
            // Webhook should still return 200 so Flutterwave doesn't keep retrying if it's our internal error
            // But actually, if we crashed, express will return 500. We already sent 200 earlier.
        }
    }
}
exports.PaymentController = PaymentController;
