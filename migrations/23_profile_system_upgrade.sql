-- Migration: 23_profile_system_upgrade.sql
-- Purpose: Support for enhanced user profiles and device telemetry.

-- 1. Add Display Name and Device Info to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_device_info JSONB DEFAULT '{}';

-- 2. Update existing rows if metadata is present
UPDATE public.users 
SET display_name = username 
WHERE display_name IS NULL;

-- 3. Policy Update: Allow users to update their own profile fields
-- (SELECT and UPDATE are already handled in schema.sql, just ensuring consistency)

-- 4. Verify
SELECT user_id, display_name, last_device_info FROM public.users LIMIT 5;
