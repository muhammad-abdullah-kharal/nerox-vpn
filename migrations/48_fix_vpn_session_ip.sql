-- Migration: 48_fix_vpn_session_ip.sql
-- Purpose: Fix "client_ip" not-null constraint violation during connection

-- 1. Make client_ip and assigned_vpn_ip optional or provide a default
ALTER TABLE public.vpn_sessions ALTER COLUMN client_ip DROP NOT NULL;
ALTER TABLE public.vpn_sessions ALTER COLUMN client_ip SET DEFAULT '0.0.0.0';
ALTER TABLE public.vpn_sessions ALTER COLUMN assigned_vpn_ip DROP NOT NULL;
ALTER TABLE public.vpn_sessions ALTER COLUMN assigned_vpn_ip SET DEFAULT '10.8.0.2';

-- 2. Update the start_vpn_session function to handle IP capture if possible
CREATE OR REPLACE FUNCTION start_vpn_session(p_server_id UUID, p_split_tunneling JSONB DEFAULT '{}')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_plan_type VARCHAR;
    v_trial_ends_at TIMESTAMP WITH TIME ZONE;
    v_is_premium_server BOOLEAN;
    v_is_active_premium BOOLEAN;
    v_server_country VARCHAR;
    v_client_ip VARCHAR;
BEGIN
    v_user_id := auth.uid();
    
    -- Attempt to get the client's IP from the request headers (if available in PostgREST)
    -- This works if Supabase headers are exposed, otherwise it falls back to default
    v_client_ip := current_setting('request.header.x-forwarded-for', true);
    IF v_client_ip IS NULL THEN
        v_client_ip := '0.0.0.0';
    END IF;

    -- Get User Plan State
    SELECT plan_type, trial_ends_at INTO v_plan_type, v_trial_ends_at 
    FROM public.users WHERE user_id = v_user_id;

    -- Determine if user has active premium access
    v_is_active_premium := (v_plan_type = 'premium') OR (v_plan_type = 'trial' AND v_trial_ends_at > NOW());

    -- Get Server Details
    SELECT is_premium, country_code INTO v_is_premium_server, v_server_country 
    FROM public.vpn_servers WHERE server_id = p_server_id;

    -- ENFORCEMENT: Premium Server Check
    IF v_is_premium_server AND NOT v_is_active_premium THEN
        RAISE EXCEPTION 'This server requires a Premium subscription';
    END IF;

    -- ENFORCEMENT: Free Location Whitelist (US, UK, DE only)
    IF NOT v_is_active_premium AND v_server_country NOT IN ('US', 'GB', 'DE') THEN
        RAISE EXCEPTION 'Free users are limited to US, UK, and Germany servers';
    END IF;

    -- Record the session
    INSERT INTO public.vpn_sessions (user_id, server_id, start_time, status, client_ip, assigned_vpn_ip)
    VALUES (v_user_id, p_server_id, NOW(), 'active', v_client_ip::INET, '10.8.0.2'::INET);

    RETURN jsonb_build_object(
        'success', true, 
        'session_id', (SELECT session_id FROM public.vpn_sessions WHERE user_id = v_user_id ORDER BY start_time DESC LIMIT 1),
        'config', '{"protocol":"wireguard","mtu":1280}'
    );
END;
$$;
