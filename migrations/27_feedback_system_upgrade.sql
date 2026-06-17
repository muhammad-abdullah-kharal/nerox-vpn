-- Migration: 27_feedback_system_upgrade.sql
-- Purpose: Add admin response capabilities to the feedback system.

-- 1. Add admin response columns
ALTER TABLE public.support_feedback 
ADD COLUMN IF NOT EXISTS admin_response TEXT,
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL;

-- 2. Update status to include 'responded' and 'closed'
-- (Status is already VARCHAR(20), so we don't need to change the type, just update the logic)

-- 3. RPC Function for admins to respond to feedback
CREATE OR REPLACE FUNCTION respond_to_feedback(
    p_feedback_id UUID,
    p_response TEXT,
    p_admin_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.support_feedback
    SET 
        admin_response = p_response,
        responded_at = NOW(),
        admin_id = p_admin_id,
        status = 'closed'
    WHERE feedback_id = p_feedback_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS for admins
-- Assuming admins are users with role = 'admin'
CREATE POLICY "Admins can view all feedback" ON public.support_feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update feedback (respond)" ON public.support_feedback
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
