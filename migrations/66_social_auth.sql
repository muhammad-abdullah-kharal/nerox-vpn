ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS apple_sub TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_provider VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
ON public.users(google_sub)
WHERE google_sub IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_sub
ON public.users(apple_sub)
WHERE apple_sub IS NOT NULL;
