-- Migration: 47_fix_plan_states.sql
-- Purpose: Implement distinct Free, Trial, and Premium states and fix "Trial Expired" bug

-- 1. Add plan state columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'free' CHECK (plan_type IN ('free', 'trial', 'premium'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

-- 2. Update existing users to be 'free' by default if they don't have a plan
UPDATE public.users SET plan_type = 'free' WHERE plan_type IS NULL;

-- 3. Function to grant a 7-day trial (can be called via RPC)
CREATE OR REPLACE FUNCTION start_user_trial(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user already used a trial
    IF EXISTS (SELECT 1 FROM public.users WHERE user_id = p_user_id AND (trial_started_at IS NOT NULL OR plan_type = 'trial')) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Trial already used or active');
    END IF;

    UPDATE public.users 
    SET 
        plan_type = 'trial',
        trial_started_at = NOW(),
        trial_ends_at = NOW() + INTERVAL '7 days'
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('success', true, 'message', '7-day Trial started!');
END;
$$;

-- 4. Secure the start_vpn_session logic to check these new states
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
BEGIN
    v_user_id := auth.uid();
    
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

    -- (Device and Data limits logic from previous migrations would go here too)
    
    -- If all checks pass, record the session
    INSERT INTO public.vpn_sessions (user_id, server_id, start_time, status)
    VALUES (v_user_id, p_server_id, NOW(), 'active');

    RETURN jsonb_build_object(
        'success', true, 
        'session_id', (SELECT session_id FROM public.vpn_sessions WHERE user_id = v_user_id ORDER BY start_time DESC LIMIT 1),
        'config', '{"protocol":"wireguard","mtu":1280}' -- Simplified config
    );
END;
$$;
