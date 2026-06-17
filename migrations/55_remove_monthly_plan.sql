-- Migration: 55_remove_monthly_plan.sql
-- Purpose: Remove the Monthly subscription plan and stick to Yearly-only premium model

-- 1. Delete the Premium Monthly plan
DELETE FROM public.subscription_plans 
WHERE name = 'Premium Monthly' OR duration_months = 1 AND price_usd > 0;

-- 2. Ensure Premium Yearly exists with the correct price ($99.99 as per latest UI)
INSERT INTO public.subscription_plans (name, duration_months, price_usd, max_devices, data_quota_gb, speed_limit_kbps, country_whitelist, features)
VALUES 
('Premium Yearly', 12, 99.99, 5, 0, 0, NULL, '{"ads": false, "streaming": true, "priority_support": true}')
ON CONFLICT (name) DO UPDATE SET
    price_usd = 99.99,
    duration_months = 12;
