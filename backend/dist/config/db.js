"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ...(process.env.NODE_ENV === 'production' ? { ssl: { rejectUnauthorized: false } } : {})
});
// Auto-migration for missing columns
const runMigrations = async () => {
    try {
        const client = await pool.connect();
        try {
            await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_data_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_protocol VARCHAR(20) DEFAULT 'Auto';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS split_tunneling_config JSONB DEFAULT '{}';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS kill_switch_enabled BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 5;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS authorized_regions TEXT[] DEFAULT '{"Global"}';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_sub TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_provider VARCHAR(20);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_sub ON users(apple_sub) WHERE apple_sub IS NOT NULL;

        ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
        ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS is_streaming_optimized BOOLEAN DEFAULT FALSE;
        ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS cpu_usage INTEGER DEFAULT 0;
        ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS avg_latency_ms INTEGER DEFAULT 0;
        ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS ssh_host TEXT;
        ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS ssh_port INTEGER DEFAULT 22;
        ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS ssh_user TEXT DEFAULT 'root';
        ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS wg_interface TEXT DEFAULT 'wg0';
        ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS wg_public_key TEXT;
        ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS wg_port INTEGER DEFAULT 51820;
        ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS wg_subnet CIDR DEFAULT '10.8.0.0/24';
        ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS endpoint_host TEXT;
        ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS endpoint_port INTEGER DEFAULT 51820;
        ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS dns_servers TEXT DEFAULT '1.1.1.1';

        ALTER TABLE vpn_sessions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        ALTER TABLE vpn_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        ALTER TABLE vpn_sessions ADD COLUMN IF NOT EXISTS total_bytes_sent BIGINT DEFAULT 0;
        ALTER TABLE vpn_sessions ADD COLUMN IF NOT EXISTS total_bytes_received BIGINT DEFAULT 0;
        ALTER TABLE vpn_sessions ADD COLUMN IF NOT EXISTS client_public_key TEXT;
        ALTER TABLE vpn_sessions ADD COLUMN IF NOT EXISTS protocol_used VARCHAR(30) DEFAULT 'WireGuard';
        ALTER TABLE vpn_sessions ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

        ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;
        ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS features_meta JSONB DEFAULT '{}';

        ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS google_product_id VARCHAR(255);
        ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS apple_product_id VARCHAR(255);

        -- Patch payment_transactions for schema evolution
        ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id);
        ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS product_id VARCHAR(255);
        ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) DEFAULT 0;
        ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2) DEFAULT 0;
        ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
        ALTER TABLE payment_transactions ALTER COLUMN amount SET DEFAULT 0;

        CREATE TABLE IF NOT EXISTS payment_transactions (
          transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(user_id),
          platform VARCHAR(50),
          product_id VARCHAR(255),
          purchase_token TEXT UNIQUE,
          status VARCHAR(50),
          amount_paid DECIMAL(10, 2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS referral_usage (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          referrer_id UUID REFERENCES users(user_id),
          referee_id UUID REFERENCES users(user_id) UNIQUE,
          referral_code VARCHAR(50),
          reward_days INTEGER DEFAULT 7,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS user_devices (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(user_id),
          device_id VARCHAR(255),
          model VARCHAR(100),
          os VARCHAR(50),
          last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, device_id)
        );

        CREATE TABLE IF NOT EXISTS support_feedback (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
          category VARCHAR(100),
          subject VARCHAR(255),
          message TEXT NOT NULL,
          admin_response TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS faq_categories (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(100) NOT NULL,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS faqs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          category_id UUID REFERENCES faq_categories(id) ON DELETE CASCADE,
          question TEXT NOT NULL,
          answer_text_1 TEXT NOT NULL,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Ensure columns exist if table was already created
        ALTER TABLE faqs ADD COLUMN IF NOT EXISTS answer_text_1 TEXT;
        ALTER TABLE faqs ADD COLUMN IF NOT EXISTS answer_text_2 TEXT;

        CREATE TABLE IF NOT EXISTS server_metrics (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          server_id UUID REFERENCES vpn_servers(server_id) ON DELETE CASCADE,
          cpu_usage INTEGER,
          avg_latency_ms INTEGER,
          active_connections INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS server_availability_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          server_id UUID REFERENCES vpn_servers(server_id) ON DELETE CASCADE,
          status VARCHAR(50),
          reason TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_vpn_servers_wireguard_ready
          ON vpn_servers(status, protocol, is_premium);
        CREATE INDEX IF NOT EXISTS idx_vpn_sessions_client_public_key
          ON vpn_sessions(client_public_key);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_vpn_sessions_active_server_ip
          ON vpn_sessions(server_id, assigned_vpn_ip)
          WHERE status = 'active';
      `);
            // Separate query for Seeding Data to prevent PostgreSQL parser errors
            // where an INSERT refers to a column that is created in the previous query
            await client.query(`
        -- Seed FAQ Categories
        INSERT INTO faq_categories (name, sort_order) 
        SELECT 'General Questions', 1 
        WHERE NOT EXISTS (SELECT 1 FROM faq_categories WHERE name = 'General Questions');

        INSERT INTO faq_categories (name, sort_order) 
        SELECT 'Troubleshooting', 2 
        WHERE NOT EXISTS (SELECT 1 FROM faq_categories WHERE name = 'Troubleshooting');

        INSERT INTO faq_categories (name, sort_order) 
        SELECT 'Privacy & Security', 3 
        WHERE NOT EXISTS (SELECT 1 FROM faq_categories WHERE name = 'Privacy & Security');

        -- =====================
        -- GENERAL QUESTIONS
        -- =====================

        INSERT INTO faqs (category_id, question, answer_text_1, sort_order)
        SELECT id, 'How do I connect to a server?', 'Tap the power button on the main screen. Nerox VPN will automatically select the fastest and most optimal server for your location. You can also manually pick a country from the server list.', 1
        FROM faq_categories WHERE name = 'General Questions'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'How do I connect to a server?');

        INSERT INTO faqs (category_id, question, answer_text_1, answer_text_2, sort_order)
        SELECT id, 'Why do I need a VPN?', 'A VPN protects your online privacy by encrypting your internet traffic and hiding your real IP address. This keeps you safe from hackers on public Wi-Fi, prevents ISPs from tracking your activity, and lets you access content from any country.', 'Without a VPN, every website you visit, every message you send, and every file you download can be monitored. Nerox VPN shields you instantly.', 2
        FROM faq_categories WHERE name = 'General Questions'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'Why do I need a VPN?');

        INSERT INTO faqs (category_id, question, answer_text_1, answer_text_2, sort_order)
        SELECT id, 'What are the benefits of Premium?', 'Nerox Premium gives you unlimited data, access to all 50+ server locations worldwide, ultra-fast speeds, ad-free experience, streaming support for Netflix & more, and priority customer support.', 'Free users are limited to 5 locations and a 500MB daily data cap. Upgrade to Premium and get the full, unrestricted Nerox experience with no limits.', 3
        FROM faq_categories WHERE name = 'General Questions'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'What are the benefits of Premium?');

        INSERT INTO faqs (category_id, question, answer_text_1, answer_text_2, sort_order)
        SELECT id, 'How do I upgrade to Premium?', 'Open the Account tab and tap "UPGRADE NOW". Choose between a Monthly or Yearly plan — the Yearly plan saves you over 30% compared to monthly billing.', 'After completing the payment, your account will instantly upgrade. You will get a confirmation notification and all Premium features will unlock immediately.', 4
        FROM faq_categories WHERE name = 'General Questions'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'How do I upgrade to Premium?');

        INSERT INTO faqs (category_id, question, answer_text_1, sort_order)
        SELECT id, 'How do I check my speed?', 'You can run a built-in speed test directly from the app. Go to the main screen, connect to a server, and tap the speed test option. It will measure your current download and upload speeds through the VPN tunnel in real time.', 5
        FROM faq_categories WHERE name = 'General Questions'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'How do I check my speed?');

        INSERT INTO faqs (category_id, question, answer_text_1, sort_order)
        SELECT id, 'How many devices can I use?', 'Free accounts support 1 device at a time. Premium accounts support up to 5 simultaneous devices, so you can protect your phone, tablet, and laptop all at once under one subscription.', 6
        FROM faq_categories WHERE name = 'General Questions'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'How many devices can I use?');

        INSERT INTO faqs (category_id, question, answer_text_1, sort_order)
        SELECT id, 'Does Nerox VPN work for streaming?', 'Yes! Premium users can stream Netflix, YouTube, Disney+, Hulu, BBC iPlayer, and other major platforms through our streaming-optimized servers — no buffering, no geo-blocks.', 7
        FROM faq_categories WHERE name = 'General Questions'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'Does Nerox VPN work for streaming?');

        -- =====================
        -- TROUBLESHOOTING
        -- =====================

        INSERT INTO faqs (category_id, question, answer_text_1, answer_text_2, sort_order)
        SELECT id, 'Can''t connect, connection is unstable, or speed is slow', 'First, check that your internet connection works without the VPN. Then try switching to a different server location — choose one geographically closer to you for the best speed.', 'If it is still unstable, go to Account Settings and change the VPN Protocol. Switching from "Auto" to "IKEv2" or "WireGuard" often resolves connectivity issues immediately.', 1
        FROM faq_categories WHERE name = 'Troubleshooting'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'Can''t connect, connection is unstable, or speed is slow');

        INSERT INTO faqs (category_id, question, answer_text_1, answer_text_2, sort_order)
        SELECT id, 'Login technical issues', 'If you cannot log in, make sure your email and password are correct. Check that your internet connection is active. If you recently registered, ensure you are using the exact email address you signed up with.', 'If the problem persists, use the "Forgot Password" option on the login screen to reset your credentials. For persistent issues, contact us via the Feedback section.', 2
        FROM faq_categories WHERE name = 'Troubleshooting'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'Login technical issues');

        INSERT INTO faqs (category_id, question, answer_text_1, answer_text_2, sort_order)
        SELECT id, 'I forgot my password', 'On the Login screen, tap "Forgot Password?" and enter the email address linked to your Nerox account. You will receive a password reset link within a few minutes.', 'If you do not see the email, check your spam/junk folder. If you still cannot access your account, contact Nerox support through the Feedback screen inside the app.', 3
        FROM faq_categories WHERE name = 'Troubleshooting'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'I forgot my password');

        INSERT INTO faqs (category_id, question, answer_text_1, sort_order)
        SELECT id, 'My VPN keeps disconnecting. How do I fix it?', 'This usually happens due to an unstable internet connection. Enable the Kill Switch in Account Settings — it will automatically block your internet if the VPN drops, preventing data leaks and reconnecting automatically.', 4
        FROM faq_categories WHERE name = 'Troubleshooting'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'My VPN keeps disconnecting. How do I fix it?');

        INSERT INTO faqs (category_id, question, answer_text_1, sort_order)
        SELECT id, 'A website is blocked even with VPN on. Why?', 'Some websites use advanced VPN-detection methods. Try switching to a different server location. If the site is still blocked, contact support via the Feedback screen and we will find a solution.', 5
        FROM faq_categories WHERE name = 'Troubleshooting'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'A website is blocked even with VPN on. Why?');

        -- =====================
        -- PRIVACY & SECURITY
        -- =====================

        INSERT INTO faqs (category_id, question, answer_text_1, answer_text_2, sort_order)
        SELECT id, 'How to fix DNS leaks?', 'A DNS leak means your real location is being exposed to your ISP even while connected to a VPN. To fix it, open Account Settings and enable DNS Leak Protection. Nerox VPN will route all DNS requests through our encrypted servers.', 'You can verify your DNS is protected by visiting dnsleaktest.com while connected. All results should show a Nerox server, not your ISP.', 1
        FROM faq_categories WHERE name = 'Privacy & Security'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'How to fix DNS leaks?');

        INSERT INTO faqs (category_id, question, answer_text_1, answer_text_2, sort_order)
        SELECT id, 'Does Nerox VPN keep logs of my activity?', 'No. Nerox VPN operates a strict zero-log policy. We never record, store, or share your browsing history, connection timestamps, IP addresses, or any personally identifiable information.', 'Your online activity is 100% private. Even Nerox itself cannot see what you do online.', 2
        FROM faq_categories WHERE name = 'Privacy & Security'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'Does Nerox VPN keep logs of my activity?');

        INSERT INTO faqs (category_id, question, answer_text_1, sort_order)
        SELECT id, 'What encryption does Nerox VPN use?', 'Nerox VPN uses AES-256 encryption — the same military-grade standard used by banks, governments, and intelligence agencies worldwide. Your connection is completely unreadable to anyone trying to intercept it.', 3
        FROM faq_categories WHERE name = 'Privacy & Security'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'What encryption does Nerox VPN use?');

        INSERT INTO faqs (category_id, question, answer_text_1, answer_text_2, sort_order)
        SELECT id, 'What is the Kill Switch?', 'The Kill Switch is a critical safety feature. If your VPN connection drops unexpectedly, it instantly cuts your internet access to prevent your real IP address from being exposed.', 'As soon as the VPN reconnects, your internet resumes automatically. You can enable or disable the Kill Switch anytime in Account Settings.', 4
        FROM faq_categories WHERE name = 'Privacy & Security'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'What is the Kill Switch?');

        INSERT INTO faqs (category_id, question, answer_text_1, sort_order)
        SELECT id, 'Is it safe to use Nerox VPN on public Wi-Fi?', 'Yes — and we strongly recommend it! Public Wi-Fi networks in cafes, airports, and hotels are a prime target for hackers. Nerox VPN encrypts all your traffic the moment you connect, making you invisible to attackers on the same network.', 5
        FROM faq_categories WHERE name = 'Privacy & Security'
        AND NOT EXISTS (SELECT 1 FROM faqs WHERE question = 'Is it safe to use Nerox VPN on public Wi-Fi?');




        -- Seed Plans
        INSERT INTO subscription_plans (name, duration_months, price_usd, max_devices, features_meta)
        VALUES 
        ('Free', 1, 0.00, 1, '{"locations_limit": 5, "streaming": false, "ads": true, "speed": "2Mbps", "priority_support": false}')
        ON CONFLICT (name) DO UPDATE SET 
          price_usd = EXCLUDED.price_usd, 
          max_devices = EXCLUDED.max_devices, 
          features_meta = EXCLUDED.features_meta;

        INSERT INTO subscription_plans (name, duration_months, price_usd, max_devices, features_meta)
        VALUES 
        ('Monthly', 1, 9.99, 3, '{"locations_limit": -1, "streaming": true, "ads": false, "speed": "Ultra", "priority_support": true}')
        ON CONFLICT (name) DO UPDATE SET 
          price_usd = EXCLUDED.price_usd, 
          max_devices = EXCLUDED.max_devices, 
          features_meta = EXCLUDED.features_meta;

        INSERT INTO subscription_plans (name, duration_months, price_usd, max_devices, features_meta)
        VALUES 
        ('Yearly', 12, 79.99, 3, '{"locations_limit": -1, "streaming": true, "ads": false, "speed": "Ultra", "priority_support": true}')
        ON CONFLICT (name) DO UPDATE SET 
          price_usd = EXCLUDED.price_usd, 
          max_devices = EXCLUDED.max_devices, 
          features_meta = EXCLUDED.features_meta;

        INSERT INTO subscription_plans (name, duration_months, price_usd, max_devices, is_custom)
        VALUES 
        ('Custom Plan', 1, 9.99, 1, TRUE)
        ON CONFLICT (name) DO UPDATE SET 
          price_usd = EXCLUDED.price_usd;
      `);
            console.log('✅ Database migrations checked/applied');
        }
        finally {
            client.release();
        }
    }
    catch (err) {
        console.error('❌ Migration Error:', err);
    }
};
runMigrations();
const query = (text, params) => pool.query(text, params);
exports.query = query;
exports.default = pool;
