-- Migration: 52_premium_subscription_logic.sql
-- Purpose: Implement automatic expiry logic and Premium feature set

-- 1. Ensure users table has subscription tracking
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE;

-- 2. Create a function to handle automatic plan downgrades
CREATE OR REPLACE FUNCTION check_and_downgrade_expired_users()
RETURNS VOID AS $$
BEGIN
    -- Downgrade users whose subscription has expired
    UPDATE public.users 
    SET plan_type = 'free'
    WHERE plan_type = 'premium' 
    AND subscription_end_date < NOW();

    -- Also handle trials if they weren't caught
    UPDATE public.users
    SET plan_type = 'free'
    WHERE plan_type = 'trial'
    AND trial_ends_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 3. Upgrade start_vpn_session with Premium feature set and expiry check
CREATE OR REPLACE FUNCTION start_vpn_session(p_server_id UUID, p_split_tunneling JSONB DEFAULT '{}')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_plan_type VARCHAR;
    v_trial_ends_at TIMESTAMP WITH TIME ZONE;
    v_sub_ends_at TIMESTAMP WITH TIME ZONE;
    v_daily_used BIGINT;
    v_daily_limit BIGINT;
    v_active_sessions INT;
    v_is_premium_server BOOLEAN;
    v_is_active_premium BOOLEAN;
    v_max_devices INT;
    v_server_country VARCHAR;
    v_client_ip VARCHAR;
BEGIN
    v_user_id := auth.uid();
    
    -- Always check for expiries first
    PERFORM check_and_downgrade_expired_users();
    PERFORM reset_daily_usage();

    -- Get User State and Limits
    SELECT plan_type, trial_ends_at, subscription_end_date, daily_data_used_bytes, daily_data_limit_bytes, max_devices 
    INTO v_plan_type, v_trial_ends_at, v_sub_ends_at, v_daily_used, v_daily_limit, v_max_devices
    FROM public.users WHERE user_id = v_user_id;

    -- Determine if user has active premium access
    v_is_active_premium := (v_plan_type = 'premium') OR (v_plan_type = 'trial' AND v_trial_ends_at > NOW());

    -- ENFORCEMENT: Data Cap (Free Tier Only)
    IF NOT v_is_active_premium AND v_daily_used >= v_daily_limit THEN
        RAISE EXCEPTION 'Daily data limit reached (500MB). Upgrade to Premium for unlimited data.';
    END IF;

    -- ENFORCEMENT: Multi-Device Support
    -- Use the user's specific max_devices limit
    SELECT COUNT(*) INTO v_active_sessions 
    FROM public.vpn_sessions 
    WHERE user_id = v_user_id AND status = 'active';
    
    IF v_active_sessions >= v_max_devices THEN
        IF v_is_active_premium THEN
            RAISE EXCEPTION 'Device limit reached (% devices). Upgrade your custom plan for more.', v_max_devices;
        ELSE
            RAISE EXCEPTION 'Free tier is limited to 1 active device. Please upgrade for multi-device support.';
        END IF;
    END IF;

    -- Get Server Details
    SELECT is_premium, country_code INTO v_is_premium_server, v_server_country 
    FROM public.vpn_servers WHERE server_id = p_server_id;

    -- ENFORCEMENT: Premium Server Check
    IF v_is_premium_server AND NOT v_is_active_premium THEN
        RAISE EXCEPTION 'This server requires a Premium subscription';
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
            'mtu', 1420,
            'priority_routing', v_is_active_premium
        )
    );
END;
$$;
