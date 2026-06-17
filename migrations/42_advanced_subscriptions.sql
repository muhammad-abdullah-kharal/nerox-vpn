-- Migration: 42_advanced_subscriptions.sql
-- Purpose: Implement backend-enforced subscription limits (Data, Devices, Locations, Speed)

-- 1. Extend subscription_plans table
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS data_quota_gb INTEGER DEFAULT 0; -- 0 = Unlimited
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS speed_limit_kbps INTEGER DEFAULT 0; -- 0 = Uncapped
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS country_whitelist TEXT[] DEFAULT NULL; -- NULL = Global
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;

-- 2. Insert/Update Standard Plans
INSERT INTO public.subscription_plans (name, duration_months, price_usd, max_devices, data_quota_gb, speed_limit_kbps, country_whitelist, features)
VALUES 
('Basic (Free)', 1, 0.00, 1, 2, 5120, ARRAY['US', 'GB', 'DE'], '{"ads": true, "streaming": false, "priority_support": false}'),
('Premium Monthly', 1, 9.99, 5, 0, 0, NULL, '{"ads": false, "streaming": true, "priority_support": true}'),
('Premium Yearly', 12, 79.99, 5, 0, 0, NULL, '{"ads": false, "streaming": true, "priority_support": true}')
ON CONFLICT (name) DO UPDATE SET
    max_devices = EXCLUDED.max_devices,
    data_quota_gb = EXCLUDED.data_quota_gb,
    speed_limit_kbps = EXCLUDED.speed_limit_kbps,
    country_whitelist = EXCLUDED.country_whitelist,
    features = EXCLUDED.features;

-- 3. Function to get current monthly data usage (in GB)
CREATE OR REPLACE FUNCTION get_monthly_usage_gb(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_bytes BIGINT;
BEGIN
    SELECT COALESCE(SUM(bytes_sent + bytes_received), 0)
    INTO v_total_bytes
    FROM public.vpn_traffic_stats s
    JOIN public.vpn_sessions sess ON s.session_id = sess.session_id
    WHERE sess.user_id = p_user_id
    AND s.timestamp >= date_trunc('month', now());
    
    RETURN (v_total_bytes::NUMERIC / (1024 * 1024 * 1024));
END;
$$;

-- 4. Re-implement start_vpn_session with Strict Enforcement
CREATE OR REPLACE FUNCTION start_vpn_session(
    p_server_id UUID,
    p_split_tunneling JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_server_record RECORD;
    v_sub_record RECORD;
    v_plan_record RECORD;
    v_active_sessions INTEGER;
    v_monthly_usage NUMERIC;
    v_session_id UUID;
    v_config JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- 1. Fetch Server
    SELECT * INTO v_server_record FROM public.vpn_servers WHERE server_id = p_server_id AND status = 'active';
    IF NOT FOUND THEN RAISE EXCEPTION 'Server not found or inactive'; END IF;

    -- 2. Fetch Subscription & Plan
    SELECT s.*, p.max_devices, p.data_quota_gb, p.speed_limit_kbps, p.country_whitelist, p.features
    INTO v_sub_record
    FROM public.subscriptions s
    JOIN public.subscription_plans p ON s.plan_id = p.plan_id
    WHERE s.user_id = v_user_id AND s.status = 'active' AND s.end_date >= CURRENT_DATE
    ORDER BY p.price_usd DESC LIMIT 1; -- Get best plan if multiple

    -- 3. If no active sub, default to "Basic (Free)" limits if it exists, otherwise block
    IF NOT FOUND THEN
        SELECT * INTO v_plan_record FROM public.subscription_plans WHERE name = 'Basic (Free)' LIMIT 1;
        IF NOT FOUND THEN RAISE EXCEPTION 'No active subscription or free plan available'; END IF;
    ELSE
        v_plan_record := v_sub_record;
    END IF;

    -- 4. ENFORCEMENT: Device Limit
    SELECT COUNT(*) INTO v_active_sessions FROM public.vpn_sessions WHERE user_id = v_user_id AND status = 'active';
    IF v_active_sessions >= v_plan_record.max_devices THEN
        RAISE EXCEPTION 'Device limit reached (% devices allowed). Please disconnect another device.', v_plan_record.max_devices;
    END IF;

    -- 5. ENFORCEMENT: Data Quota
    IF v_plan_record.data_quota_gb > 0 THEN
        v_monthly_usage := get_monthly_usage_gb(v_user_id);
        IF v_monthly_usage >= v_plan_record.data_quota_gb THEN
            RAISE EXCEPTION 'Monthly data limit reached (% GB). Please upgrade to Premium.', v_plan_record.data_quota_gb;
        END IF;
    END IF;

    -- 6. ENFORCEMENT: Location Restrictions
    IF v_plan_record.country_whitelist IS NOT NULL THEN
        IF NOT (v_server_record.country_code = ANY(v_plan_record.country_whitelist)) THEN
            RAISE EXCEPTION 'This location is only available for Premium users.';
        END IF;
    END IF;

    -- 7. ENFORCEMENT: Premium Server access
    IF v_server_record.is_premium AND (v_sub_record.subscription_id IS NULL OR (v_plan_record.features->>'streaming')::BOOLEAN = FALSE) THEN
        RAISE EXCEPTION 'Premium subscription with streaming support required for this server';
    END IF;

    -- 8. Success: Build Config and Insert Session
    v_config := jsonb_build_object(
        'protocol', v_server_record.protocol,
        'endpoint', v_server_record.ip_address,
        'port', 51820,
        'speed_limit_kbps', v_plan_record.speed_limit_kbps,
        'assigned_ip', '10.8.0.' || (FLOOR(RANDOM() * 254) + 2)::TEXT,
        'dns', ARRAY['1.1.1.1', '8.8.8.8'],
        'exclude_list', p_split_tunneling
    );

    INSERT INTO public.vpn_sessions (user_id, server_id, client_ip, assigned_vpn_ip, status, config, used_split_tunneling)
    VALUES (v_user_id, p_server_id, '0.0.0.0', (v_config->>'assigned_ip')::INET, 'active', v_config, p_split_tunneling)
    RETURNING session_id INTO v_session_id;

    RETURN jsonb_build_object(
        'session_id', v_session_id,
        'config', v_config,
        'plan_name', v_plan_record.name
    );
END;
$$;
