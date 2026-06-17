-- Migration: 57_fix_users_insert_policy.sql
-- Purpose: Allow new users to insert their own profile record during signup

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users 
FOR INSERT WITH CHECK (auth.uid() = user_id);
