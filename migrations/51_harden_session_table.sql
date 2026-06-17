-- Migration: 51_harden_session_table.sql
-- Purpose: Ensure all required columns exist for professional session tracking

ALTER TABLE public.vpn_sessions 
ADD COLUMN IF NOT EXISTS bytes_sent BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS bytes_received BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;

-- Ensure indexes for performance
CREATE INDEX IF NOT EXISTS idx_vpn_sessions_user_status ON public.vpn_sessions(user_id, status);
