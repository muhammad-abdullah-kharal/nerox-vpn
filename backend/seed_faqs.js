const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const faqs = {
  'Login': [
    { q: 'How do I create an account?', a1: 'Download the Nerox VPN app and tap Get Started. Enter your email and create a password. A 7-day free trial will be activated automatically with no credit card required.', a2: null, order: 1 },
    { q: 'I forgot my password', a1: 'On the Login screen, tap Forgot Password and enter your registered email. You will receive a password reset link within a few minutes.', a2: 'If you do not see the email, check your spam folder. Contact support through the Feedback screen if the issue continues.', order: 2 },
    { q: 'Login technical issues', a1: 'Make sure your email and password are correct and your internet connection is active. Try closing and reopening the app.', a2: 'If you recently registered, use the same email you signed up with. Use Forgot Password to reset your credentials if needed.', order: 3 },
    { q: 'Can I use Nerox VPN on multiple devices?', a1: 'Free accounts are limited to 1 device. Premium accounts allow up to 5 simultaneous devices under a single account.', a2: null, order: 4 },
    { q: 'How do I log out of my account?', a1: 'Go to the Account tab and tap the logout icon in the top-right corner. You will be asked to confirm. Your VPN connection will be terminated after logout.', a2: null, order: 5 },
  ],
  'Connection': [
    { q: 'How do I connect to a server?', a1: 'Tap the power button on the main screen. Nerox VPN automatically connects you to the fastest optimal server. You can also manually select a country from the server list.', a2: null, order: 1 },
    { q: 'Cannot connect, connection is unstable, or speed is slow', a1: 'Check that your regular internet connection is working. Then try switching to a server closer to your location for better speed.', a2: 'If it is still unstable, go to Account Settings and change the VPN Protocol. Switching from Auto to IKEv2 or WireGuard often resolves the issue immediately.', order: 2 },
    { q: 'My VPN keeps disconnecting. How do I fix it?', a1: 'This usually happens due to an unstable internet connection. Enable the Kill Switch in Account Settings to automatically block internet when VPN drops, preventing data leaks.', a2: null, order: 3 },
    { q: 'Why is my VPN connection slow?', a1: 'VPN speeds depend on your base internet speed, the selected server distance, and server load. Choose a server geographically closer to you for the fastest connection.', a2: 'You can also switch the VPN Protocol in Account Settings. WireGuard is typically the fastest protocol available.', order: 4 },
    { q: 'How do I check my connection speed?', a1: 'Connect to a VPN server and use the built-in speed test on the main screen. It measures your live download and upload speeds through the encrypted tunnel in real time.', a2: null, order: 5 },
    { q: 'A website is still blocked with VPN on. Why?', a1: 'Some websites use advanced VPN-detection technology. Try switching to a different server location. If it is still blocked, contact us through the Feedback screen.', a2: null, order: 6 },
  ],
  'Premium': [
    { q: 'What are the benefits of Premium?', a1: 'Nerox Premium gives you unlimited data, access to all 50 plus server locations worldwide, ultra-fast speeds, streaming support for Netflix and more, ad-free experience, and priority customer support.', a2: 'Free users are limited to 5 locations and a 500MB daily data cap. Upgrade to unlock the full Nerox experience with zero limits.', order: 1 },
    { q: 'How do I upgrade to Premium?', a1: 'Open the Account tab and tap UPGRADE NOW. Choose Monthly or Yearly. The Yearly plan saves you over 30 percent compared to monthly billing.', a2: 'After payment, your account upgrades instantly and all Premium features unlock immediately without restarting the app.', order: 2 },
    { q: 'What is the difference between Free and Premium?', a1: 'Free plan: 5 server locations, 500MB daily limit, basic speeds, with ads. Premium plan: 50 plus locations, unlimited data, ultra-fast speeds, streaming support, no ads, priority support.', a2: null, order: 3 },
    { q: 'Does Nerox VPN work for streaming?', a1: 'Yes! Premium users can stream Netflix, YouTube, Disney Plus, Hulu, BBC iPlayer, and other platforms through our streaming-optimized servers with no buffering and no geo-blocks.', a2: null, order: 4 },
    { q: 'How do I use the free trial?', a1: 'Every new account automatically gets a 7-day free trial with full Premium access. No credit card is required to start the trial.', a2: 'When the trial ends, the account switches to the Free plan unless you upgrade. You will receive a notification before your trial expires.', order: 5 },
  ],
  'Privacy': [
    { q: 'Why do I need a VPN?', a1: 'A VPN encrypts your internet traffic and hides your real IP address, protecting you from hackers, preventing ISPs from tracking your activity, and letting you access content from anywhere.', a2: 'Without a VPN, every website you visit and message you send can be monitored. Nerox VPN shields you the moment you connect.', order: 1 },
    { q: 'Does Nerox VPN keep logs of my activity?', a1: 'No. Nerox VPN operates a strict zero-log policy. We never record, store, or share your browsing history, connection timestamps, IP addresses, or any personally identifiable information.', a2: 'Your online activity is 100 percent private. Even the Nerox team cannot see what you do online.', order: 2 },
    { q: 'What encryption does Nerox VPN use?', a1: 'Nerox VPN uses AES-256 encryption, the same military-grade standard used by banks, governments, and intelligence agencies. Your connection is completely unreadable to anyone intercepting it.', a2: null, order: 3 },
    { q: 'How to fix DNS leaks?', a1: 'A DNS leak exposes your real location to your ISP even while connected to a VPN. Enable DNS Leak Protection in Account Settings to route all DNS requests through our encrypted servers.', a2: 'You can verify protection by visiting dnsleaktest.com while connected. All results should show a Nerox server, not your ISP.', order: 4 },
    { q: 'What is the Kill Switch?', a1: 'The Kill Switch instantly cuts your internet access if the VPN connection drops unexpectedly. This prevents your real IP address from being accidentally exposed during reconnection.', a2: 'Internet resumes automatically when the VPN reconnects. Enable or disable it anytime in Account Settings.', order: 5 },
    { q: 'Is it safe to use Nerox VPN on public Wi-Fi?', a1: 'Yes, and we strongly recommend it. Public Wi-Fi in cafes, airports, and hotels is a common target for hackers. Nerox VPN encrypts all your traffic the moment you connect.', a2: null, order: 6 },
  ],
  'Payment': [
    { q: 'What payment methods are accepted?', a1: 'Nerox VPN accepts all major credit and debit cards including Visa, Mastercard, and Amex, as well as Google Pay, Apple Pay, and in-app purchases through the Play Store and App Store.', a2: null, order: 1 },
    { q: 'How do I cancel my subscription?', a1: 'You can cancel anytime through the Google Play Store or Apple App Store. Go to your account subscriptions and select Nerox VPN to manage or cancel.', a2: 'Your Premium access continues until the end of the current billing period. You will not be charged again after cancellation.', order: 2 },
    { q: 'Can I get a refund?', a1: 'We offer a 30-day money-back guarantee on all Premium plans. Contact us through the Feedback section and our support team will process your refund promptly.', a2: null, order: 3 },
    { q: 'When will I be charged?', a1: 'For Monthly plans, you are charged on the same day each month. For Yearly plans, you are charged once per year on your subscription start date anniversary.', a2: 'You will receive a receipt by email for every charge. Renewal reminders are sent 3 days before each billing date.', order: 4 },
    { q: 'Does my subscription renew automatically?', a1: 'Yes, subscriptions renew automatically at the end of each billing period. You can turn off auto-renewal anytime from the Google Play Store or Apple App Store subscription settings.', a2: null, order: 5 },
  ],
};

const cats = ['Login', 'Connection', 'Premium', 'Privacy', 'Payment'];

async function reseed() {
  await pool.query('TRUNCATE TABLE faqs RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE TABLE faq_categories RESTART IDENTITY CASCADE');

  for (let i = 0; i < cats.length; i++) {
    const name = cats[i];
    const { rows } = await pool.query(
      'INSERT INTO faq_categories (name, sort_order) VALUES ($1, $2) RETURNING id',
      [name, i + 1]
    );
    const catId = rows[0].id;
    for (const faq of faqs[name]) {
      await pool.query(
        'INSERT INTO faqs (category_id, question, answer_text_1, answer_text_2, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [catId, faq.q, faq.a1, faq.a2, faq.order]
      );
    }
    console.log('Seeded ' + name + ': ' + faqs[name].length + ' FAQs');
  }
  await pool.end();
  console.log('All done!');
}

reseed().catch(e => { console.error(e.message); process.exit(1); });
