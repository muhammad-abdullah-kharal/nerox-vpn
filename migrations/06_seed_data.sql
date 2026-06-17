-- 6. Seed Data
-- Initial servers and subscription plans for the application

-- Seed VPN Servers
INSERT INTO public.vpn_servers (hostname, ip_address, location, country_code, data_center, protocol, status, max_connections, current_load)
VALUES 
('de-frankfurt-01', '1.1.1.1', 'Germany', 'DE', 'AWS EU-Central-1', 'WireGuard', 'active', 500, 45),
('us-newyork-01', '2.2.2.2', 'United States', 'US', 'Digital Ocean NY3', 'OpenVPN', 'active', 1000, 12),
('ca-toronto-05', '3.3.3.3', 'Canada', 'CA', 'Google Cloud CA-East-1', 'WireGuard', 'active', 750, 88),
('au-sydney-03', '4.4.4.4', 'Australia', 'AU', 'Vultr Sydney', 'IKEv2', 'active', 300, 5),
('fr-paris-02', '5.5.5.5', 'France', 'FR', 'OVH Paris', 'OpenVPN', 'active', 500, 62),
('gb-london-08', '6.6.6.6', 'United Kingdom', 'GB', 'Linode London', 'WireGuard', 'active', 1000, 31)
ON CONFLICT (hostname) DO NOTHING;

-- Seed Subscription Plans
INSERT INTO public.subscription_plans (name, duration_months, price_usd, features, max_devices)
VALUES 
('Basic', 1, 9.99, '{"ads": true, "speed": "high"}', 1),
('Premium', 1, 19.99, '{"ads": false, "speed": "ultra"}', 5),
('Enterprise', 12, 0.00, '{"ads": false, "speed": "dedicated"}', 100)
ON CONFLICT (name) DO NOTHING;
