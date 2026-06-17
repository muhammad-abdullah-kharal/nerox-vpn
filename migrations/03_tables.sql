-- 3. Tables
-- Creating the structural core of the database

-- Users Profile Table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role user_role DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_to TIMESTAMP WITH TIME ZONE,
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    last_health_check TIMESTAMP WITH TIME ZONE
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
    client_ip INET NOT NULL,
    assigned_vpn_ip INET NOT NULL,
    status session_status DEFAULT 'active'
);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    plan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    duration_months INTEGER NOT NULL,
    price_usd DECIMAL(10,2) NOT NULL,
    features JSONB DEFAULT '{}',
    max_devices INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE
);

-- User Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
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
    amount DECIMAL(10,2) NOT NULL,
    status transaction_status DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE
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
CREATE TABLE IF NOT EXISTS public.vpn_traffic_stats (
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
