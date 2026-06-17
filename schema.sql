-- Nerox VPN Database Schema (Production Ready - Standalone PostgreSQL)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'manager', 'user');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vpn_protocol') THEN
        CREATE TYPE vpn_protocol AS ENUM ('OpenVPN', 'WireGuard', 'IKEv2');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vpn_status') THEN
        CREATE TYPE vpn_status AS ENUM ('active', 'inactive', 'maintenance');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
        CREATE TYPE session_status AS ENUM ('active', 'disconnected', 'expired');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
        CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed');
    END IF;
END $$;

-- 2. TABLES

-- Users Profile Table
CREATE TABLE IF NOT EXISTS public.users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(6),
    verification_expires_at TIMESTAMP WITH TIME ZONE,
    password_hash TEXT,
    role user_role DEFAULT 'user',
    plan_type VARCHAR(50) DEFAULT 'free',
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    daily_data_limit_bytes BIGINT DEFAULT 524288000,
    daily_data_used_bytes BIGINT DEFAULT 0,
    last_data_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    avatar_url TEXT,
    display_name VARCHAR(255),
    referral_code VARCHAR(50) UNIQUE,
    split_tunneling_config JSONB DEFAULT '{}',
    preferred_protocol VARCHAR(50) DEFAULT 'Auto',
    kill_switch_enabled BOOLEAN DEFAULT FALSE,
    max_devices INTEGER DEFAULT 1,
    authorized_regions TEXT[] DEFAULT ARRAY['Global'],
    trial_started_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_to TIMESTAMP WITH TIME ZONE,
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAQ Categories
CREATE TABLE IF NOT EXISTS public.faq_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0
);

-- FAQs
CREATE TABLE IF NOT EXISTS public.faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES public.faq_categories(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer_text_1 TEXT NOT NULL,
    answer_text_2 TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Support Feedback
CREATE TABLE IF NOT EXISTS public.support_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    category VARCHAR(100),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    admin_response TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Internal Groups (Admins/Managers)
CREATE TABLE IF NOT EXISTS public.groups (
    group_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_admin BOOLEAN DEFAULT FALSE
);

-- User-Group Mapping
CREATE TABLE IF NOT EXISTS public.user_groups (
    user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.groups(group_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, group_id)
);

-- VPN Servers
CREATE TABLE IF NOT EXISTS public.vpn_servers (
    server_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hostname VARCHAR(100) UNIQUE NOT NULL,
    ip_address INET NOT NULL,
    location VARCHAR(100) NOT NULL,
    country_code CHAR(2) NOT NULL,
    data_center VARCHAR(100) NOT NULL,
    max_connections INTEGER DEFAULT 1000,
    current_load INTEGER DEFAULT 0,
    protocol vpn_protocol NOT NULL,
    status vpn_status DEFAULT 'active',
    is_premium BOOLEAN DEFAULT FALSE,
    is_streaming_optimized BOOLEAN DEFAULT FALSE,
    cpu_usage INTEGER DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    last_health_check TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ssh_host TEXT,
    ssh_port INTEGER DEFAULT 22,
    ssh_user TEXT DEFAULT 'root',
    wg_interface TEXT DEFAULT 'wg0',
    wg_public_key TEXT,
    wg_port INTEGER DEFAULT 51820,
    wg_subnet CIDR DEFAULT '10.8.0.0/24',
    endpoint_host TEXT,
    endpoint_port INTEGER DEFAULT 51820,
    dns_servers TEXT DEFAULT '1.1.1.1'
);

-- Network Definitions
CREATE TABLE IF NOT EXISTS public.networks (
    network_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cidr_range CIDR UNIQUE NOT NULL,
    description VARCHAR(255),
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Network-Group Access
CREATE TABLE IF NOT EXISTS public.network_groups (
    network_id UUID REFERENCES public.networks(network_id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.groups(group_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (network_id, group_id)
);

-- VPN Sessions
CREATE TABLE IF NOT EXISTS public.vpn_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    server_id UUID REFERENCES public.vpn_servers(server_id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    client_ip INET NOT NULL,
    assigned_vpn_ip INET NOT NULL,
    status session_status DEFAULT 'active',
    total_bytes_sent BIGINT DEFAULT 0,
    total_bytes_received BIGINT DEFAULT 0,
    client_public_key TEXT,
    protocol_used VARCHAR(30) DEFAULT 'WireGuard',
    provisioned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vpn_servers_wireguard_ready
ON public.vpn_servers(status, protocol, is_premium);

CREATE INDEX IF NOT EXISTS idx_vpn_sessions_client_public_key
ON public.vpn_sessions(client_public_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vpn_sessions_active_server_ip
ON public.vpn_sessions(server_id, assigned_vpn_ip)
WHERE status = 'active';

-- Subscription Plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    plan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    duration_months INTEGER NOT NULL,
    price_usd DECIMAL(10,2) NOT NULL,
    features JSONB DEFAULT '{}',
    features_meta JSONB DEFAULT '{}',
    max_devices INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    is_custom BOOLEAN DEFAULT FALSE,
    google_product_id VARCHAR(255), -- Added for verification logic
    apple_product_id VARCHAR(255)   -- Added for verification logic
);

-- User Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE UNIQUE,
    plan_id UUID REFERENCES public.subscription_plans(plan_id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status subscription_status DEFAULT 'active',
    auto_renew BOOLEAN DEFAULT TRUE,
    payment_method VARCHAR(100)
);

-- Payment Transactions
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID REFERENCES public.subscriptions(subscription_id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2),
    status transaction_status DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    platform VARCHAR(50), -- Added for consistency with verify-purchase
    product_id VARCHAR(255),
    purchase_token TEXT UNIQUE, -- Added for consistency with verify-purchase
    verification_response JSONB -- Added for consistency with verify-purchase
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Traffic Stats (Partitioned)
DROP TABLE IF EXISTS public.vpn_traffic_stats CASCADE;
CREATE TABLE public.vpn_traffic_stats (
    stat_id UUID DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.vpn_sessions(session_id) ON DELETE CASCADE,
    bytes_sent BIGINT DEFAULT 0,
    bytes_received BIGINT DEFAULT 0,
    packets_sent BIGINT DEFAULT 0,
    packets_received BIGINT DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (stat_id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Initial partitions for 2026
CREATE TABLE IF NOT EXISTS public.vpn_traffic_stats_2026_04 PARTITION OF public.vpn_traffic_stats 
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS public.vpn_traffic_stats_2026_05 PARTITION OF public.vpn_traffic_stats 
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Hourly Aggregates
CREATE TABLE IF NOT EXISTS public.vpn_hourly_stats (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES public.vpn_sessions(session_id) ON DELETE CASCADE,
    total_bytes_sent BIGINT,
    total_bytes_received BIGINT,
    start_hour TIMESTAMP WITH TIME ZONE,
    UNIQUE (session_id, start_hour)
);

-- 3. FUNCTIONS
-- Optimal server selection logic
CREATE OR REPLACE FUNCTION get_optimal_server()
RETURNS TABLE(server_id UUID, hostname VARCHAR, current_load INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT s.server_id, s.hostname, s.current_load
    FROM vpn_servers s
    WHERE s.status = 'active'
    ORDER BY s.current_load ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Referral Usage
CREATE TABLE IF NOT EXISTS public.referral_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    referee_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE UNIQUE,
    referral_code VARCHAR(50),
    reward_days INTEGER DEFAULT 7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
