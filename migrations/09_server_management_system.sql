-- 9. Server Management System Enhancements
-- This migration updates server properties and adds sophisticated filtering logic

-- 1. Schema Enhancements
ALTER TABLE public.vpn_servers 
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS country VARCHAR(100),
ADD COLUMN IF NOT EXISTS latency_ms INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS supported_protocols vpn_protocol[] DEFAULT ARRAY['WireGuard'::vpn_protocol];

-- Seed initial city/country data from the existing 'location' column (usually "City, Country")
UPDATE public.vpn_servers 
SET 
    city = trim(split_part(location, ',', 1)), 
    country = trim(split_part(location, ',', 2))
WHERE city IS NULL;

-- 2. Enhanced Server Listing RPC
-- Automatically filters by:
-- - Active status
-- - Load (< 100%)
-- - User subscription level (Premium vs Free)
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
    -- Note: If user is not logged in (v_user_id is NULL), we treat them as Free
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
    AND s.current_load < 100 -- Automatically exclude overloaded servers
    AND (v_is_premium_user OR s.is_premium = FALSE) -- Access level restriction
    ORDER BY s.is_premium DESC, s.current_load ASC; -- Show premium first for premium users, then sort by load
END;
$$;

-- 3. Monitoring RPC (for future automation/monitoring scripts)
CREATE OR REPLACE FUNCTION update_server_health(
    p_server_id UUID,
    p_load INTEGER,
    p_latency INTEGER,
    p_status vpn_status
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.vpn_servers 
    SET 
        current_load = p_load, 
        latency_ms = p_latency, 
        status = p_status, 
        last_health_check = NOW()
    WHERE server_id = p_server_id;
    
    RETURN FOUND;
END;
$$;


-- 4. Enhanced Optimal Server Selection
-- Automatically excludes overloaded (>100% load) or inactive servers
DROP FUNCTION IF EXISTS get_optimal_server();
DROP FUNCTION IF EXISTS get_optimal_server(BOOLEAN);

CREATE OR REPLACE FUNCTION get_optimal_server()
RETURNS TABLE(server_id UUID, hostname VARCHAR, current_load INTEGER, is_premium BOOLEAN) AS $$
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
    SELECT s.server_id, s.hostname, s.current_load, s.is_premium
    FROM public.vpn_servers s
    WHERE s.status = 'active'
    AND s.current_load < 100 -- Exclude overloaded
    AND (v_is_premium_user OR s.is_premium = FALSE) -- Access level restriction
    ORDER BY s.current_load ASC -- Pick lowest load
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
