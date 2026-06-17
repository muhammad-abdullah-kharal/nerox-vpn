-- Migration: 20_standardize_subscriptions.sql
-- Purpose: Standardize subscription plans to Free, Monthly, and Yearly tiers using a safe upsert.

-- 1. Remove legacy or duplicate plans
DELETE FROM public.subscription_plans 
WHERE name NOT IN ('Monthly Premium', 'Yearly Premium', 'Free Plan');

-- 2. Create or Update standard tiers
INSERT INTO public.subscription_plans (name, duration_months, price_usd, features, is_active)
VALUES 
(
  'Monthly Premium', 
  1, 
  9.99, 
  '{"ads": "No Ads", "speed": "Ultra Speed", "servers": "All Premium Servers"}'::JSONB, 
  TRUE
),
(
  'Yearly Premium', 
  12, 
  59.99, 
  '{"ads": "No Ads", "speed": "Ultra Speed (Best Value)", "servers": "All Premium Servers"}'::JSONB, 
  TRUE
),
(
  'Free Plan', 
  0, 
  0.00, 
  '{"ads": "Sponsored Ads", "speed": "Standard Speed", "servers": "Basic Regional Servers"}'::JSONB, 
  TRUE
)
ON CONFLICT (name) DO UPDATE 
SET duration_months = EXCLUDED.duration_months,
    price_usd = EXCLUDED.price_usd,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active;

-- 3. Verify
SELECT plan_id, name, duration_months, price_usd FROM public.subscription_plans;
