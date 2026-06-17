-- Migration: 37_feedback_schema_fix.sql
-- Purpose: Make support_feedback consistent with other tables by referencing public.users instead of auth.users.

-- 1. Drop the old constraint that points to auth.users
ALTER TABLE public.support_feedback 
DROP CONSTRAINT IF EXISTS support_feedback_user_id_fkey;

-- 2. Add the new constraint that points to public.users
ALTER TABLE public.support_feedback 
ADD CONSTRAINT support_feedback_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;
