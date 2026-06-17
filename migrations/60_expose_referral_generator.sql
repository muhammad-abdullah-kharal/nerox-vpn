-- Migration: 60_expose_referral_generator.sql
-- Purpose: Expose the referral code generator as an RPC for client-side fallback

CREATE OR REPLACE FUNCTION public.generate_unique_referral_code_rpc()
RETURNS TEXT AS $$
BEGIN
    RETURN generate_unique_referral_code();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
