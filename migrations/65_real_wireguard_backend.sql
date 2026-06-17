-- Migration: 65_real_wireguard_backend.sql
-- Purpose: Add the metadata needed for the Node backend to provision real
-- WireGuard peers over SSH.

ALTER TABLE public.vpn_servers
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_streaming_optimized BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cpu_usage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_latency_ms INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS ssh_host TEXT,
ADD COLUMN IF NOT EXISTS ssh_port INTEGER DEFAULT 22,
ADD COLUMN IF NOT EXISTS ssh_user TEXT DEFAULT 'root',
ADD COLUMN IF NOT EXISTS wg_interface TEXT DEFAULT 'wg0',
ADD COLUMN IF NOT EXISTS wg_public_key TEXT,
ADD COLUMN IF NOT EXISTS wg_port INTEGER DEFAULT 51820,
ADD COLUMN IF NOT EXISTS wg_subnet CIDR DEFAULT '10.8.0.0/24',
ADD COLUMN IF NOT EXISTS endpoint_host TEXT,
ADD COLUMN IF NOT EXISTS endpoint_port INTEGER DEFAULT 51820,
ADD COLUMN IF NOT EXISTS dns_servers TEXT DEFAULT '1.1.1.1';

ALTER TABLE public.vpn_sessions
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS total_bytes_sent BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_bytes_received BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS client_public_key TEXT,
ADD COLUMN IF NOT EXISTS protocol_used VARCHAR(30) DEFAULT 'WireGuard',
ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_vpn_servers_wireguard_ready
ON public.vpn_servers(status, protocol, is_premium);

CREATE INDEX IF NOT EXISTS idx_vpn_sessions_client_public_key
ON public.vpn_sessions(client_public_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vpn_sessions_active_server_ip
ON public.vpn_sessions(server_id, assigned_vpn_ip)
WHERE status = 'active';

INSERT INTO public.vpn_servers (
  hostname,
  ip_address,
  location,
  country_code,
  data_center,
  protocol,
  status,
  is_premium,
  ssh_host,
  ssh_port,
  ssh_user,
  wg_interface,
  wg_public_key,
  wg_port,
  wg_subnet,
  endpoint_host,
  endpoint_port,
  dns_servers
)
VALUES
  (
    'uk-wg-01.neroxvpn.com',
    '138.68.142.167',
    'London',
    'GB',
    'DigitalOcean-UK',
    'WireGuard',
    'active',
    false,
    '138.68.142.167',
    22,
    'root',
    'wg0',
    'pQmxbl/yoxDhTJKc3UsM2LBxMRL7zB/oAJ6WV8INknc=',
    51820,
    '10.8.0.0/24',
    '138.68.142.167',
    51820,
    '1.1.1.1'
  ),
  (
    'us-wg-01.neroxvpn.com',
    '64.23.142.203',
    'San Francisco',
    'US',
    'DigitalOcean-SFO',
    'WireGuard',
    'active',
    false,
    '64.23.142.203',
    22,
    'root',
    'wg0',
    'pQmxbl/yoxDhTJKc3UsM2LBxMRL7zB/oAJ6WV8INknc=',
    51820,
    '10.8.0.0/24',
    '64.23.142.203',
    51820,
    '1.1.1.1'
  ),
  (
    'de-wg-01.neroxvpn.com',
    '164.92.239.136',
    'Frankfurt',
    'DE',
    'DigitalOcean-DE',
    'WireGuard',
    'active',
    false,
    '164.92.239.136',
    22,
    'root',
    'wg0',
    'GZcjiTfQeV6k/82PcNiE/HFpU651CnTSQrcjjoVgMg8=',
    51820,
    '10.8.0.0/24',
    '164.92.239.136',
    51820,
    '1.1.1.1'
  ),
  (
    'sg-wg-01.neroxvpn.com',
    '139.59.227.78',
    'Singapore',
    'SG',
    'DigitalOcean-SG',
    'WireGuard',
    'active',
    false,
    '139.59.227.78',
    22,
    'root',
    'wg0',
    'KUoTSGlJFACFIlCie7N/R5D6fDs+s20GzBx/INaw43o=',
    51820,
    '10.8.0.0/24',
    '139.59.227.78',
    51820,
    '1.1.1.1'
  ),
  (
    'in-wg-01.neroxvpn.com',
    '168.144.74.177',
    'Bangalore',
    'IN',
    'DigitalOcean-IN',
    'WireGuard',
    'active',
    false,
    '168.144.74.177',
    22,
    'root',
    'wg0',
    'f4F1ZN8RcEjkEfsJGCETTja8/c5VAEPnlrTq5lCFwhM=',
    51820,
    '10.8.0.0/24',
    '168.144.74.177',
    51820,
    '1.1.1.1'
  )
ON CONFLICT (hostname) DO UPDATE SET
  ip_address = EXCLUDED.ip_address,
  location = EXCLUDED.location,
  country_code = EXCLUDED.country_code,
  data_center = EXCLUDED.data_center,
  protocol = EXCLUDED.protocol,
  status = EXCLUDED.status,
  is_premium = EXCLUDED.is_premium,
  ssh_host = EXCLUDED.ssh_host,
  ssh_port = EXCLUDED.ssh_port,
  ssh_user = EXCLUDED.ssh_user,
  wg_interface = EXCLUDED.wg_interface,
  wg_public_key = EXCLUDED.wg_public_key,
  wg_port = EXCLUDED.wg_port,
  wg_subnet = EXCLUDED.wg_subnet,
  endpoint_host = EXCLUDED.endpoint_host,
  endpoint_port = EXCLUDED.endpoint_port,
  dns_servers = EXCLUDED.dns_servers;
