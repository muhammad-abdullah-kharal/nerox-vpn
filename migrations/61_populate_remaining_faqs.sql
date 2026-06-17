-- Migration: 61_populate_remaining_faqs.sql
-- Purpose: Add missing FAQ questions for Login, Payment, Premium, Privacy, and Technical categories.

-- 1. Ensure Categories exist
INSERT INTO public.faq_categories (name, sort_order) VALUES
('Login', 2),
('Payment', 3),
('Premium', 4),
('Privacy', 5),
('Technical', 6)
ON CONFLICT (name) DO NOTHING;

-- 2. Seed FAQs
DO $$ 
DECLARE
    v_login_id UUID;
    v_payment_id UUID;
    v_premium_id UUID;
    v_privacy_id UUID;
    v_technical_id UUID;
BEGIN
    SELECT id INTO v_login_id FROM public.faq_categories WHERE name = 'Login';
    SELECT id INTO v_payment_id FROM public.faq_categories WHERE name = 'Payment';
    SELECT id INTO v_premium_id FROM public.faq_categories WHERE name = 'Premium';
    SELECT id INTO v_privacy_id FROM public.faq_categories WHERE name = 'Privacy';
    SELECT id INTO v_technical_id FROM public.faq_categories WHERE name = 'Technical';

    -- Login FAQs
    IF v_login_id IS NOT NULL THEN
        INSERT INTO public.faqs (category_id, question, answer_text_1, sort_order)
        VALUES 
        (v_login_id, 'I forgot my password', 'Go to the Login screen and tap ''Forgot Password'' to reset it via email.', 1),
        (v_login_id, 'Can''t log in with my email', 'Ensure you have verified your email address and that there are no typos in your email or password.', 2)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Payment FAQs
    IF v_payment_id IS NOT NULL THEN
        INSERT INTO public.faqs (category_id, question, answer_text_1, sort_order)
        VALUES 
        (v_payment_id, 'What payment methods do you accept?', 'We accept major credit cards, PayPal, and Google Play Store payments.', 1),
        (v_payment_id, 'Is my payment secure?', 'Yes, all transactions are encrypted and processed through secure payment gateways.', 2)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Premium FAQs
    IF v_premium_id IS NOT NULL THEN
        INSERT INTO public.faqs (category_id, question, answer_text_1, sort_order)
        VALUES 
        (v_premium_id, 'What are the benefits of Premium?', 'Premium users get unlimited bandwidth, access to all global servers, and no advertisements.', 1),
        (v_premium_id, 'How do I upgrade to Premium?', 'Go to the ''Subscription'' screen from the menu and choose a plan that fits your needs.', 2)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Privacy FAQs
    IF v_privacy_id IS NOT NULL THEN
        INSERT INTO public.faqs (category_id, question, answer_text_1, sort_order)
        VALUES 
        (v_privacy_id, 'Do you keep logs?', 'No, we have a strict no-logs policy. We do not track or store your browsing activity.', 1),
        (v_privacy_id, 'What information do you collect?', 'We only collect minimal data necessary to maintain your account and ensure service quality.', 2)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Technical FAQs
    IF v_technical_id IS NOT NULL THEN
        INSERT INTO public.faqs (category_id, question, answer_text_1, sort_order)
        VALUES 
        (v_technical_id, 'Why is my connection dropping?', 'Connection drops can be caused by unstable local Wi-Fi or interference from other apps. Try switching to the WireGuard protocol for better stability.', 1),
        (v_technical_id, 'Does NEROX support Kill Switch?', 'Yes, you can enable the Kill Switch in the Settings menu to prevent data leaks if the VPN connection drops.', 2),
        (v_technical_id, 'How to fix DNS leaks?', 'Our app automatically handles DNS routing to prevent leaks. If you suspect a leak, ensure ''Private DNS'' is set to ''Automatic'' in your Android system settings.', 3)
        ON CONFLICT DO NOTHING;
    END IF;

END $$;

