-- Migration: 16_split_tunneling_sync.sql
-- Add split tunneling configuration storage to users table

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS split_tunneling_config JSONB DEFAULT '{}';

-- Optional: Update start_vpn_session to record the split tunneling config used for the session
ALTER TABLE public.vpn_sessions
ADD COLUMN IF NOT EXISTS used_split_tunneling JSONB DEFAULT '{}';

-- Update start_vpn_session to accept and record split tunneling config (Optional Enhancement)
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
    v_subscription_record RECORD;
    v_session_id UUID;
    v_config JSONB;
    v_client_ip INET;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Fetch Server Details
    SELECT * INTO v_server_record FROM public.vpn_servers WHERE server_id = p_server_id AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Server not found or inactive';
    END IF;

    -- 2. Check Subscription for Premium Servers
    IF v_server_record.is_premium THEN
        SELECT * INTO v_subscription_record 
        FROM public.subscriptions 
        WHERE user_id = v_user_id AND status = 'active' AND end_date >= CURRENT_DATE
        LIMIT 1;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Premium subscription required for this server';
        END IF;
    END IF;

    -- 3. Generate Mock Config
    v_config := jsonb_build_object(
        'protocol', v_server_record.protocol,
        'endpoint', v_server_record.ip_address,
        'port', 51820,
        'public_key', 'base64_encoded_server_public_key',
        'assigned_ip', '10.8.0.' || (FLOOR(RANDOM() * 254) + 2)::TEXT,
        'dns', ARRAY['1.1.1.1', '8.8.8.8'],
        'exclude_list', p_split_tunneling -- Passing the exclusions to the config
    );

    -- 4. Create Session
    INSERT INTO public.vpn_sessions (
        user_id, 
        server_id, 
        client_ip, 
        assigned_vpn_ip, 
        status, 
        config,
        used_split_tunneling
    ) VALUES (
        v_user_id,
        p_server_id,
        '0.0.0.0', 
        (v_config->>'assigned_ip')::INET,
        'active',
        v_config,
        p_split_tunneling
    ) RETURNING session_id INTO v_session_id;

    -- 5. Return Session Info
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
