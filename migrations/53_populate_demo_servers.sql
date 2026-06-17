-- Migration: 53_populate_demo_servers.sql
-- Purpose: Add active servers for demo and testing

-- 1. Ensure we have some active servers for Free and Premium
INSERT INTO public.vpn_servers (server_id, hostname, ip_address, location, data_center, country_code, city, status, is_premium, protocol, supported_protocols, current_load)
VALUES 
  (gen_random_uuid(), 'us-free-01.neroxvpn.com', '1.1.1.1', 'New York', 'Nerox Core', 'US', 'New York', 'active', false, 'OpenVPN_UDP'::vpn_protocol, ARRAY['OpenVPN_UDP', 'WireGuard']::vpn_protocol[], 10),
  (gen_random_uuid(), 'uk-free-01.neroxvpn.com', '2.2.2.2', 'London', 'Nerox Core', 'GB', 'London', 'active', false, 'OpenVPN_UDP'::vpn_protocol, ARRAY['OpenVPN_UDP', 'WireGuard']::vpn_protocol[], 15),
  (gen_random_uuid(), 'sg-premium-01.neroxvpn.com', '3.3.3.3', 'Singapore', 'Nerox Core', 'SG', 'Singapore', 'active', true, 'OpenVPN_UDP'::vpn_protocol, ARRAY['OpenVPN_UDP', 'WireGuard']::vpn_protocol[], 5)
ON CONFLICT DO NOTHING;
