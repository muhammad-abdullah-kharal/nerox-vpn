-- Migration: 43_custom_plan_logic.sql
-- Purpose: Support dynamic custom plan creation and subscription

CREATE OR REPLACE FUNCTION create_custom_subscription(
    p_months INTEGER,
    p_devices INTEGER,
    p_global_access BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_plan_id UUID;
    v_price DECIMAL(10,2);
    v_base_monthly DECIMAL := 2.00;
    v_device_monthly DECIMAL := (p_devices - 1) * 1.00;
    v_global_monthly DECIMAL := CASE WHEN p_global_access THEN 5.00 ELSE 0 END;
    v_monthly_total DECIMAL;
    v_discount NUMERIC;
    v_plan_name TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- 1. Calculate Price (matching frontend logic but enforced here)
    v_monthly_total := v_base_monthly + v_device_monthly + v_global_monthly;
    v_discount := CASE 
        WHEN p_months >= 12 THEN 0.7 
        WHEN p_months >= 3 THEN 0.85 
        ELSE 1 
    END;
    v_price := (v_monthly_total * p_months * v_discount);

    v_plan_name := 'Custom (' || p_months || 'm, ' || p_devices || 'd' || CASE WHEN p_global_access THEN ', Global' ELSE '' END || ')';

    -- 2. Create/Get unique custom plan entry
    INSERT INTO public.subscription_plans (
        name, duration_months, price_usd, max_devices, 
        data_quota_gb, speed_limit_kbps, country_whitelist, 
        features, is_custom, is_active
    )
    VALUES (
        v_plan_name, p_months, v_price, p_devices, 
        0, 0, CASE WHEN p_global_access THEN NULL ELSE ARRAY['US', 'GB', 'DE']::TEXT[] END,
        jsonb_build_object('ads', false, 'streaming', true, 'custom', true),
        TRUE, FALSE -- Not active for public listing
    )
    ON CONFLICT (name) DO UPDATE SET price_usd = EXCLUDED.price_usd
    RETURNING plan_id INTO v_plan_id;

    -- 3. Create the subscription
    INSERT INTO public.subscriptions (
        user_id, plan_id, start_date, end_date, status, auto_renew
    )
    VALUES (
        v_user_id, v_plan_id, CURRENT_DATE, CURRENT_DATE + (p_months || ' months')::INTERVAL, 'active', FALSE
    );

    RETURN jsonb_build_object(
        'success', true,
        'plan_id', v_plan_id,
        'price', v_price,
        'message', 'Custom plan activated successfully'
    );
END;
$$;
