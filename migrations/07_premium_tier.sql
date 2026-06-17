-- 7. Premium Tier Enhancements
-- Adding the ability to differentiate between Free and Premium servers

-- Add is_premium column to vpn_servers
ALTER TABLE public.vpn_servers 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;

-- Update some servers to be Premium
UPDATE public.vpn_servers SET is_premium = TRUE WHERE hostname IN ('au-sydney-03', 'gb-london-08');

-- Update get_optimal_server to only return non-premium servers by default
-- Or we can keep it as is and handle the check in the app
CREATE OR REPLACE FUNCTION get_optimal_server(prefer_premium BOOLEAN DEFAULT FALSE)
RETURNS TABLE(server_id UUID, hostname VARCHAR, current_load INTEGER, is_premium BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT s.server_id, s.hostname, s.current_load, s.is_premium
    FROM public.vpn_servers s
    WHERE s.status = 'active'
    AND (prefer_premium OR s.is_premium = FALSE)
    ORDER BY s.current_load ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
