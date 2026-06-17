-- 2. Enums
-- Defining various states and roles for the application
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
