-- 1. Protection Trigger: Prevent automated scripts from deleting safety servers
CREATE OR REPLACE FUNCTION protect_safety_servers()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent deletion of core safety servers
    IF (TG_OP = 'DELETE') THEN
        IF (OLD.hostname LIKE '%free-01%' OR OLD.hostname LIKE '%safety%') THEN
            RAISE EXCEPTION 'Safety servers cannot be deleted. Disable the protection trigger to remove them.';
        END IF;
    END IF;

    -- Prevent safety servers from being moved to maintenance by auto-scaling scripts
    IF (TG_OP = 'UPDATE') THEN
        IF (NEW.hostname LIKE '%free-01%' AND NEW.status = 'maintenance') THEN
            NEW.status := 'active'; -- FORCE it back to active
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_safety_servers ON public.vpn_servers;
CREATE TRIGGER tr_protect_safety_servers
BEFORE UPDATE OR DELETE ON public.vpn_servers
FOR EACH ROW EXECUTE FUNCTION protect_safety_servers();

-- 2. Seed/Restore Activity
INSERT INTO public.vpn_servers (hostname, ip_address, location, country_code, data_center, protocol, status, is_premium)
VALUES 
    ('us-free-01.neroxvpn.com', '104.21.7.200', 'New York', 'US', 'DigitalOcean-NY3', 'OpenVPN_UDP', 'active', false),
    ('gb-free-01.neroxvpn.com', '172.67.132.100', 'London', 'GB', 'Linode-London', 'WireGuard', 'active', false),
    ('sg-free-01.neroxvpn.com', '104.26.4.150', 'Singapore', 'SG', 'AWS-Singapore', 'OpenVPN_TCP', 'active', false)
ON CONFLICT (hostname) DO UPDATE SET 
    status = 'active',
    is_premium = false,
    data_center = EXCLUDED.data_center;

UPDATE public.vpn_servers SET status = 'active' WHERE hostname LIKE '%premium%' OR hostname LIKE '%ultra%';
