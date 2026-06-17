-- Migration: 28_faq_system.sql
-- Purpose: Dynamic FAQ system with categories and search support.

-- 1. Create Categories Table
CREATE TABLE IF NOT EXISTS public.faq_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create FAQs Table
CREATE TABLE IF NOT EXISTS public.faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.faq_categories(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer_text_1 TEXT NOT NULL,
    answer_text_2 TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Security (RLS)
ALTER TABLE public.faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FAQs are viewable by everyone" ON public.faq_categories
    FOR SELECT USING (true);

CREATE POLICY "FAQs details are viewable by everyone" ON public.faqs
    FOR SELECT USING (true);

-- 4. Seed Data
-- Categories
INSERT INTO public.faq_categories (name, sort_order) VALUES
('Connection', 1),
('Login', 2),
('Payment', 3),
('Premium', 4)
ON CONFLICT (name) DO NOTHING;

-- FAQs (Connection)
DO $$ 
DECLARE
    v_cat_id UUID;
BEGIN
    SELECT id INTO v_cat_id FROM public.faq_categories WHERE name = 'Connection';
    
    INSERT INTO public.faqs (category_id, question, answer_text_1, answer_text_2, sort_order)
    VALUES 
    (v_cat_id, 'Why I need a VPN?', 'When NEROX is connecting it presents a VPN dialog for the user to give permission to start the VPN.', 'If you cannot click OK or check the box, there might be another app on top of the dialog.', 1),
    (v_cat_id, 'Can’t connect, not stable or speed is slow', 'Try switching to a different server or protocol (WireGuard is often fastest).', 'Ensure your internet connection is stable before connecting.', 2)
    ON CONFLICT DO NOTHING;
END $$;
