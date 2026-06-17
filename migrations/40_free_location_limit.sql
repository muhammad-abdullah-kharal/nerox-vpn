-- Migration: 40_free_location_limit.sql
-- Purpose: Restrict free users to 3 locations (US, GB, DE) while allowing full access for Premium/Trial users.

-- 1. DROP EXISTING FUNCTIONS TO AVOID RETURN TYPE CONFLICTS
DROP FUNCTION IF EXISTS is_user_premium(uuid);
DROP FUNCTION IF EXISTS get_available_servers();
DROP FUNCTION IF EXISTS get_smart_servers(integer, vpn_protocol);
DROP FUNCTION IF EXISTS get_smart_servers(integer, text);
DROP FUNCTION IF EXISTS start_vpn_session(uuid, jsonb);

-- 2. Enhanced Premium Check (Checks both profile and subscriptions)
CREATE OR REPLACE FUNCTION is_user_premium(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE user_id = p_user_id 
        AND plan_type = 'premium' 
        AND (subscription_end_date >= NOW() OR subscription_end_date IS NULL)
    ) OR EXISTS (
        SELECT 1 FROM public.subscriptions s
        JOIN public.subscription_plans p ON s.plan_id = p.plan_id
        WHERE s.user_id = p_user_id AND s.status = 'active' AND s.end_date >= CURRENT_DATE AND p.price_usd > 0
    );
END;
$$;

-- 3. Update get_available_servers
CREATE OR REPLACE FUNCTION get_available_servers()
RETURNS TABLE (
    server_id UUID,
    hostname VARCHAR,
    ip_address INET,
    city VARCHAR,
    country VARCHAR,
    country_code CHAR(2),
    current_load INTEGER,
    latency_ms INTEGER,
    supported_protocols vpn_protocol[],
    is_premium BOOLEAN,
    status vpn_status
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_is_premium BOOLEAN;
    v_is_trial BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    v_is_premium := is_user_premium(v_user_id);
    v_is_trial := is_user_in_trial(v_user_id);

    RETURN QUERY
    SELECT 
        s.server_id, s.hostname, s.ip_address, s.city, s.country, 
        s.country_code, s.current_load, s.latency_ms, s.supported_protocols, 
        s.is_premium, s.status
    FROM public.vpn_servers s
    WHERE s.status = 'active'
    AND s.current_load < 100 
    -- Access Logic:
    AND (
        (v_is_premium OR v_is_trial) -- Full list for trial/premium
        OR 
        (s.is_premium = FALSE AND s.country_code IN ('US', 'GB', 'DE')) -- Restricted list for others
    )
    AND (v_is_premium OR s.is_premium = FALSE)
    ORDER BY s.is_premium DESC, s.current_load ASC;
END;
$$;

-- 4. Update get_smart_servers
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
    v_is_premium BOOLEAN;
    v_is_trial BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    v_is_premium := is_user_premium(v_user_id);
    v_is_trial := is_user_in_trial(v_user_id);

    RETURN QUERY
    SELECT 
        s.server_id, s.hostname, s.city, s.country, s.country_code, 
        s.current_load, s.latency_ms, s.is_premium,
        ((s.latency_ms * 0.7) + (s.current_load * 0.3))::NUMERIC as smart_score,
        s.protocol
    FROM public.vpn_servers s
    WHERE s.status = 'active'
    AND s.current_load < 100
    -- Access Logic:
    AND (
        (v_is_premium OR v_is_trial) 
        OR 
        (s.is_premium = FALSE AND s.country_code IN ('US', 'GB', 'DE'))
    )
    AND (v_is_premium OR s.is_premium = FALSE)
    AND (p_protocol = 'Auto' OR s.protocol = p_protocol)
    ORDER BY smart_score ASC
    LIMIT p_amount;
END;
$$;

-- 5. Update start_vpn_session for enforcement
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
    v_is_premium BOOLEAN;
    v_is_trial BOOLEAN;
    v_session_id UUID;
    v_config JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_is_premium := is_user_premium(v_user_id);
    v_is_trial := is_user_in_trial(v_user_id);

    -- Fetch Server Details
    SELECT * INTO v_server_record FROM public.vpn_servers WHERE server_id = p_server_id AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Server not found or inactive';
    END IF;

    -- ENFORCEMENT LOGIC
    IF NOT v_is_premium AND NOT v_is_trial THEN
        -- User is on Free plan
        IF v_server_record.is_premium THEN
            RAISE EXCEPTION 'Premium subscription required for this server';
        END IF;
        
        IF v_server_record.country_code NOT IN ('US', 'GB', 'DE') THEN
            RAISE EXCEPTION 'Free users are limited to USA, UK, and Germany locations.';
        END IF;
    END IF;

    -- Proceed with session creation
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
