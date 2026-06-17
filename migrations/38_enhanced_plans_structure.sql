-- Migration: 38_enhanced_plans_structure.sql
-- Purpose: Formalize tiered subscription features and seed Basic and Premium tiers.

-- 1. Ensure columns are structured correctly for features (we'll use JSONB for flexibility but seed specific keys)
-- We'll also add a few helper columns for the new requirements if they don't exist.
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS speed_limit_kbps INTEGER, -- NULL for unlimited
ADD COLUMN IF NOT EXISTS data_cap_mb INTEGER,      -- NULL for unlimited
ADD COLUMN IF NOT EXISTS ads_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS priority_support BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS streaming_optimized BOOLEAN DEFAULT FALSE;

-- 2. Clean up old placeholder plans to avoid confusion
UPDATE public.subscription_plans SET is_active = FALSE;

-- 3. Seed Basic Plan (Free)
INSERT INTO public.subscription_plans (
    name, 
    duration_months, 
    price_usd, 
    max_devices, 
    speed_limit_kbps, 
    data_cap_mb, 
    ads_enabled, 
    priority_support, 
    streaming_optimized,
    features
) VALUES (
    'Basic',
    1,
    0.00,
    1,
    5000, -- 5 Mbps throttled
    2048, -- 2GB Cap
    TRUE,
    FALSE,
    FALSE,
    '{"locations": "3 locations", "speed": "Standard Speed", "ads": "Ads Enabled", "devices": "1 Device", "support": "Basic Support"}'
) ON CONFLICT (name) DO UPDATE SET is_active = TRUE;

-- 4. Seed Premium Plan (Monthly)
INSERT INTO public.subscription_plans (
    name, 
    duration_months, 
    price_usd, 
    max_devices, 
    speed_limit_kbps, 
    data_cap_mb, 
    ads_enabled, 
    priority_support, 
    streaming_optimized,
    features,
    apple_product_id,
    google_product_id
) VALUES (
    'Premium',
    1,
    9.99,
    5,
    NULL, -- Unlimited
    NULL, -- Unlimited
    FALSE,
    TRUE,
    TRUE,
    '{"locations": "Global Access", "speed": "Ultra Speed", "ads": "No Ads", "devices": "Up to 5 Devices", "support": "Priority 24/7", "streaming": "Optimized for Streaming"}',
    'com.fastvpn.premium.monthly',
    'com.fastvpn.premium.monthly'
) ON CONFLICT (name) DO UPDATE SET is_active = TRUE;

-- 5. Seed Premium Plan (Yearly - Best Value)
INSERT INTO public.subscription_plans (
    name, 
    duration_months, 
    price_usd, 
    max_devices, 
    speed_limit_kbps, 
    data_cap_mb, 
    ads_enabled, 
    priority_support, 
    streaming_optimized,
    features,
    apple_product_id,
    google_product_id
) VALUES (
    'Premium Yearly',
    12,
    99.99,
    10,
    NULL,
    NULL,
    FALSE,
    TRUE,
    TRUE,
    '{"locations": "Global Access", "speed": "Ultra Speed", "ads": "No Ads", "devices": "Up to 10 Devices", "support": "Priority 24/7", "streaming": "Optimized for Streaming"}',
    'com.fastvpn.premium.yearly',
    'com.fastvpn.premium.yearly'
) ON CONFLICT (name) DO UPDATE SET is_active = TRUE;

-- 6. Add "Custom" Plan metadata (This serves as a base/template if needed, 
-- but will largely be handled dynamically in UI)
INSERT INTO public.subscription_plans (
    name, 
    duration_months, 
    price_usd, 
    max_devices, 
    is_active,
    features
) VALUES (
    'Custom',
    1,
    0.00, -- Dynamic
    1,
    TRUE,
    '{"customizable": true, "note": "Configure your own limits"}'
) ON CONFLICT (name) DO NOTHING;

-- Verification
SELECT name, price_usd, features FROM public.subscription_plans WHERE is_active = TRUE;
