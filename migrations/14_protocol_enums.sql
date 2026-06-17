-- 14. Protocol Management - Part 1: Enums
-- Run this first and wait for it to complete.

DO $$ BEGIN
    ALTER TYPE vpn_protocol ADD VALUE IF NOT EXISTS 'IPSec';
    ALTER TYPE vpn_protocol ADD VALUE IF NOT EXISTS 'OpenVPN_UDP';
    ALTER TYPE vpn_protocol ADD VALUE IF NOT EXISTS 'OpenVPN_TCP';
    ALTER TYPE vpn_protocol ADD VALUE IF NOT EXISTS 'Auto';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
