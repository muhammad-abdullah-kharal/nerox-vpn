-- Migration: 49_enforce_free_tier_limits.sql
-- Purpose: Implement backend enforcement for Free Plan restrictions

-- 1. Add usage tracking columns if they don't exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_data_limit_bytes BIGINT DEFAULT 524288000; -- 500MB Default
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_data_used_bytes BIGINT DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_usage_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Create a function to reset daily usage
CREATE OR REPLACE FUNCTION reset_daily_usage()
RETURNS VOID AS $$
BEGIN
    UPDATE public.users 
    SET daily_data_used_bytes = 0, 
        last_usage_reset = NOW()
    WHERE last_usage_reset < (NOW() - INTERVAL '1 day');
END;
$$ LANGUAGE plpgsql;

-- 3. Upgrade start_vpn_session with all restrictions
CREATE OR REPLACE FUNCTION start_vpn_session(p_server_id UUID, p_split_tunneling JSONB DEFAULT '{}')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_plan_type VARCHAR;
    v_trial_ends_at TIMESTAMP WITH TIME ZONE;
    v_daily_used BIGINT;
    v_daily_limit BIGINT;
    v_active_sessions INT;
    v_is_premium_server BOOLEAN;
    v_is_active_premium BOOLEAN;
    v_server_country VARCHAR;
    v_client_ip VARCHAR;
BEGIN
    v_user_id := auth.uid();
    
    -- Reset daily usage if needed before checking
    PERFORM reset_daily_usage();

    -- Get User State and Limits
    SELECT plan_type, trial_ends_at, daily_data_used_bytes, daily_data_limit_bytes 
    INTO v_plan_type, v_trial_ends_at, v_daily_used, v_daily_limit
    FROM public.users WHERE user_id = v_user_id;

    -- Determine if user has active premium access (Paid or Active Trial)
    v_is_active_premium := (v_plan_type = 'premium') OR (v_plan_type = 'trial' AND v_trial_ends_at > NOW());

    -- ENFORCEMENT 1: Data Cap Check (Free Tier Only)
    IF NOT v_is_active_premium AND v_daily_used >= v_daily_limit THEN
        RAISE EXCEPTION 'Daily data limit reached (500MB). Upgrade to Premium for unlimited data.';
    END IF;

    -- ENFORCEMENT 2: Single Device Check (Free Tier Only)
    IF NOT v_is_active_premium THEN
        SELECT COUNT(*) INTO v_active_sessions 
        FROM public.vpn_sessions 
        WHERE user_id = v_user_id AND status = 'active';
        
        IF v_active_sessions >= 1 THEN
            RAISE EXCEPTION 'Free tier is limited to 1 active device. Please disconnect your other device.';
        END IF;
    END IF;

    -- Get Server Details
    SELECT is_premium, country_code INTO v_is_premium_server, v_server_country 
    FROM public.vpn_servers WHERE server_id = p_server_id;

    -- ENFORCEMENT 3: Premium Server Check
    IF v_is_premium_server AND NOT v_is_active_premium THEN
        RAISE EXCEPTION 'This server requires a Premium subscription';
    END IF;

    -- ENFORCEMENT 4: Free Location Whitelist (US, UK, DE only)
    IF NOT v_is_active_premium AND v_server_country NOT IN ('US', 'GB', 'DE') THEN
        RAISE EXCEPTION 'Free users are limited to US, UK, and Germany servers';
    END IF;

    -- Record the session
    v_client_ip := COALESCE(current_setting('request.header.x-forwarded-for', true), '0.0.0.0');
    
    INSERT INTO public.vpn_sessions (user_id, server_id, start_time, status, client_ip, assigned_vpn_ip)
    VALUES (v_user_id, p_server_id, NOW(), 'active', v_client_ip::INET, '10.8.0.2'::INET);

    RETURN jsonb_build_object(
        'success', true, 
        'session_id', (SELECT session_id FROM public.vpn_sessions WHERE user_id = v_user_id ORDER BY start_time DESC LIMIT 1),
        'ads_enabled', NOT v_is_active_premium,
        'config', jsonb_build_object(
            'protocol', CASE WHEN v_is_active_premium THEN 'wireguard' ELSE 'openvpn' END,
            'mtu', 1280
        )
    );
END;
$$;
