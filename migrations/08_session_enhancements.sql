-- Update session_status to include failed state
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum e 
        JOIN pg_type t ON e.enumtypid = t.oid 
        WHERE t.typname = 'session_status' AND e.enumlabel = 'failed'
    ) THEN
        ALTER TYPE session_status ADD VALUE 'failed';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- Add config column to track the configuration sent to the client
ALTER TABLE public.vpn_sessions 
ADD COLUMN IF NOT EXISTS config JSONB;

-- Function to start a VPN session
CREATE OR REPLACE FUNCTION start_vpn_session(p_server_id UUID)
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

    -- 3. Generate Mock Config (Wait, for real app we'd call an external API or use a key generation logic)
    -- We'll generate a WireGuard style config for demonstration
    v_config := jsonb_build_object(
        'protocol', v_server_record.protocol,
        'endpoint', v_server_record.ip_address,
        'port', 51820,
        'public_key', 'base64_encoded_server_public_key',
        'assigned_ip', '10.8.0.' || (FLOOR(RANDOM() * 254) + 2)::TEXT,
        'dns', ARRAY['1.1.1.1', '8.8.8.8']
    );

    -- 4. Create Session
    INSERT INTO public.vpn_sessions (
        user_id, 
        server_id, 
        client_ip, 
        assigned_vpn_ip, 
        status, 
        config
    ) VALUES (
        v_user_id,
        p_server_id,
        '0.0.0.0', -- In a real Edge Function we'd get the real client IP
        (v_config->>'assigned_ip')::INET,
        'active',
        v_config
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


-- Function to end a VPN session
CREATE OR REPLACE FUNCTION end_vpn_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    UPDATE public.vpn_sessions 
    SET status = 'disconnected', end_time = NOW() 
    WHERE session_id = p_session_id AND user_id = v_user_id;

    RETURN FOUND;
END;
$$;

