-- 11. Freshness Check for Server Active Status
-- Ensures that servers are only shown in the app if they have reported health within the last 5 minutes

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
    v_is_premium_user BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Check if user is premium
    IF v_user_id IS NULL THEN
        v_is_premium_user := FALSE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.subscriptions 
            WHERE user_id = v_user_id AND status = 'active' AND end_date >= CURRENT_DATE
        ) INTO v_is_premium_user;
    END IF;

    RETURN QUERY
    SELECT 
        s.server_id, s.hostname, s.ip_address, s.city, s.country, 
        s.country_code, s.current_load, s.latency_ms, s.supported_protocols, 
        s.is_premium, s.status
    FROM public.vpn_servers s
    WHERE s.status = 'active'
    AND s.current_load < 100 
    -- FRESHNESS CHECK: Only show servers that have reported health in the last 5 minutes
    -- (Or brand new servers that haven't heart-beated yet if they were just created)
    AND (s.last_health_check > NOW() - INTERVAL '5 minutes' OR s.last_health_check IS NULL)
    AND (v_is_premium_user OR s.is_premium = FALSE)
    ORDER BY s.is_premium DESC, s.current_load ASC;
END;
$$;
