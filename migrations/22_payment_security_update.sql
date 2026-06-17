-- Migration: 22_payment_security_update.sql
-- Purpose: Support for Apple/Google Store IDs and secure backend-verified transactions.

-- 1. Add Store IDs to Subscription Plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS apple_product_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS google_product_id VARCHAR(255);

-- Populate with placeholders (User can update these in Supabase UI)
UPDATE public.subscription_plans SET apple_product_id = 'com.fastvpn.monthly', google_product_id = 'com.fastvpn.monthly' WHERE name = 'Monthly Premium';
UPDATE public.subscription_plans SET apple_product_id = 'com.fastvpn.yearly', google_product_id = 'com.fastvpn.yearly' WHERE name = 'Yearly Premium';

-- 2. Enhance Payment Transactions for backend verification data
ALTER TABLE public.payment_transactions 
ADD COLUMN IF NOT EXISTS platform VARCHAR(20), -- 'ios' or 'android'
ADD COLUMN IF NOT EXISTS purchase_token TEXT,  -- Google purchaseToken or Apple receiptData
ADD COLUMN IF NOT EXISTS verification_response JSONB; -- Store full response from Apple/Google for audit

-- 3. Standardize RLS for transactions
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only view their own transactions" ON public.payment_transactions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.subscriptions WHERE subscription_id = payment_transactions.subscription_id AND user_id = auth.uid())
);

-- 4. Verify
SELECT plan_id, name, apple_product_id, google_product_id FROM public.subscription_plans;
