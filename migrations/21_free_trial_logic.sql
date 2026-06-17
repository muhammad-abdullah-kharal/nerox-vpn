-- Migration: 21_free_trial_logic.sql
-- Purpose: Implement 7-day trial limit for Free Plan users.

-- 1. Helper function to check if user is in trial period
CREATE OR REPLACE FUNCTION is_user_in_trial(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT created_at INTO v_created_at FROM public.users WHERE user_id = p_user_id;
    
    -- If created_at is within the last 7 days, return TRUE
    RETURN v_created_at > (NOW() - INTERVAL '7 days');
END;
$$;


-- 2. Update get_smart_servers
CREATE OR REPLACE FUNCTION get_smart_servers(p_amount INTEGER DEFAULT 5, p_protocol vpn_protocol DEFAULT 'Auto')
RETURNS TABLE (
    server_id UUID,
    hostname VARCHAR,
    city VARCHAR,
    country VARCHAR,
    country_code CHAR(2),
    current_load INTEGER,
    latency_ms INTEGER,
    is_premium BOOLEAN,
    smart_score NUMERIC,
    protocol vpn_protocol
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_is_premium_user BOOLEAN;
    v_is_trial_active BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Check Premium status
    IF v_user_id IS NULL THEN
        v_is_premium_user := FALSE;
        v_is_trial_active := FALSE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.subscriptions 
            WHERE user_id = v_user_id AND status = 'active' AND end_date >= CURRENT_DATE
        ) INTO v_is_premium_user;
        
        -- Check Trial status
        v_is_trial_active := is_user_in_trial(v_user_id);
    END IF;

    -- Block access if neither premium nor trial is active
    IF NOT v_is_premium_user AND NOT v_is_trial_active THEN
        RETURN; -- Return nothing (empty table)
    END IF;

    -- Return Ranked List
    RETURN QUERY
    SELECT 
        s.server_id, s.hostname, s.city, s.country, s.country_code, 
        s.current_load, s.latency_ms, s.is_premium,
        ((s.latency_ms * 0.7) + (s.current_load * 0.3))::NUMERIC as smart_score,
        s.protocol
    FROM public.vpn_servers s
    WHERE s.status = 'active'
    AND s.current_load < 100
    AND (s.last_health_check > NOW() - INTERVAL '5 minutes' OR s.last_health_check IS NULL)
    -- Filter servers based on premium level
    AND (v_is_premium_user OR s.is_premium = FALSE)
    AND (p_protocol = 'Auto' OR s.protocol = p_protocol)
    ORDER BY smart_score ASC
    LIMIT p_amount;
END;
$$;


-- 3. Update start_vpn_session
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
    v_is_premium_user BOOLEAN;
    v_is_trial_active BOOLEAN;
    v_session_id UUID;
    v_config JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- A. Check if user has access at all (Premium OR Trial)
    SELECT EXISTS (
        SELECT 1 FROM public.subscriptions 
        WHERE user_id = v_user_id AND status = 'active' AND end_date >= CURRENT_DATE
    ) INTO v_is_premium_user;
    
    v_is_trial_active := is_user_in_trial(v_user_id);

    IF NOT v_is_premium_user AND NOT v_is_trial_active THEN
        RAISE EXCEPTION 'Free trial expired. Please upgrade to a premium plan to continue using Nerox.';
    END IF;

    -- B. Fetch Server Details
    SELECT * INTO v_server_record FROM public.vpn_servers WHERE server_id = p_server_id AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Server not found or inactive';
    END IF;

    -- C. Strict Check for Premium Servers
    IF v_server_record.is_premium AND NOT v_is_premium_user THEN
        RAISE EXCEPTION 'Premium subscription required for this server';
    END IF;

    -- D. Generate & Create Session
    v_config := jsonb_build_object(
        'protocol', v_server_record.protocol,
        'endpoint', v_server_record.ip_address,
        'port', 51820,
        'public_key', 'base64_encoded_server_public_key',
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
        'server', jsonb_build_object(
            'hostname', v_server_record.hostname,
            'location', v_server_record.location,
            'country_code', v_server_record.country_code,
            'is_premium', v_server_record.is_premium
        )
    );
END;
$$;
