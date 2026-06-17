-- Migration: 59_restore_monthly_plan.sql
-- Purpose: Restore the Monthly subscription plan alongside the Yearly plan

-- 1. Insert/Update the Premium Monthly plan
INSERT INTO public.subscription_plans (name, duration_months, price_usd, max_devices, data_quota_gb, speed_limit_kbps, country_whitelist, features)
VALUES 
('Premium Monthly', 1, 9.99, 5, 0, 0, NULL, '{"ads": false, "streaming": true, "priority_support": true}')
ON CONFLICT (name) DO UPDATE SET
    price_usd = 9.99,
    duration_months = 1,
    is_active = TRUE;

-- 2. Ensure Premium Yearly is also active
UPDATE public.subscription_plans SET is_active = TRUE WHERE name = 'Premium Yearly';
