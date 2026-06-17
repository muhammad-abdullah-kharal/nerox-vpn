-- Migration: 33_otp_system.sql
-- Purpose: Implementation of a high-security OTP flow with a 5-minute expiration window.

-- 1. Create OTP Codes Table
CREATE TABLE IF NOT EXISTS public.otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Indexing for Performance
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON public.otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_code ON public.otp_codes(code);

-- 3. RLS (Secure - only service role should handle codes)
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- 4. RPC to Generate OTP (Internal)
CREATE OR REPLACE FUNCTION generate_otp_code(p_email TEXT)
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
BEGIN
    -- Generate 6-digit random code
    v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    -- Invalidate old codes for this email
    UPDATE public.otp_codes SET used = TRUE WHERE email = p_email AND used = FALSE;
    
    -- Insert new code with 5-minute expiry
    INSERT INTO public.otp_codes (email, code, expires_at)
    VALUES (p_email, v_code, NOW() + INTERVAL '5 minutes');
    
    RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC to Verify OTP
CREATE OR REPLACE FUNCTION verify_otp_code(p_email TEXT, p_code TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT, reset_token UUID) AS $$
DECLARE
    v_otp_id UUID;
    v_reset_token UUID;
BEGIN
    -- Find a valid, matching, non-expired code
    SELECT id INTO v_otp_id
    FROM public.otp_codes
    WHERE email = p_email 
      AND code = p_code 
      AND used = FALSE 
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_otp_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Invalid or expired code'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- Mark code as used
    UPDATE public.otp_codes SET used = TRUE WHERE id = v_otp_id;

    -- Generate a one-time reset token (valid for 10 minutes)
    v_reset_token := gen_random_uuid();
    
    -- Store this token in the user's metadata or a temp table
    -- For simplicity, we'll store it in a new reset_tokens table
    CREATE TABLE IF NOT EXISTS public.reset_tokens (
        token UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
    );

    INSERT INTO public.reset_tokens (token, user_id, expires_at)
    SELECT v_reset_token, user_id, NOW() + INTERVAL '10 minutes'
    FROM public.users
    WHERE email = p_email;

    RETURN QUERY SELECT TRUE, 'Success'::TEXT, v_reset_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC to Finalize Password Reset
CREATE OR REPLACE FUNCTION reset_password_with_token(p_token UUID, p_new_password TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Validate token
    SELECT user_id INTO v_user_id
    FROM public.reset_tokens
    WHERE token = p_token AND expires_at > NOW();

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid or expired reset token');
    END IF;

    -- Update User Auth Password
    -- NOTE: In Supabase, updating auth.users from public schema requires service role 
    -- or we use the supabase.auth.admin API from the edge function.
    -- To keep it secure, we'll return the user info and let the edge function perform the reset.
    
    -- Cleanup token
    DELETE FROM public.reset_tokens WHERE token = p_token;

    -- Here we actually update the password if we have permissions
    -- Using the supabase.auth.admin extension if available
    UPDATE auth.users 
    SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
    WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
