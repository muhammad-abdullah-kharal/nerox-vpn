-- Migration: 56_enable_custom_plan_limits.sql
-- Purpose: Ensure the users table can store custom device limits

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 1;

-- Update existing premium users to 5 devices by default
UPDATE public.users SET max_devices = 5 WHERE plan_type = 'premium' AND max_devices = 1;
UPDATE public.users SET max_devices = 1 WHERE plan_type = 'free';
