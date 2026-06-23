#!/bin/bash
set -e

cd /opt/nerox-backend
apt-get install -y unzip
unzip -o backend.zip

sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'NewPassword123';"
sudo -u postgres psql -c "CREATE DATABASE nerox_vpn;" || true
sudo -u postgres psql -d nerox_vpn -f schema.sql
sudo -u postgres psql -d nerox_vpn -f dump.sql

npm install

cat << 'EOF' > .env
PORT=5000
DATABASE_URL=postgresql://postgres:NewPassword123@localhost:5432/nerox_vpn
REDIS_URL=redis://localhost:6379
JWT_SECRET=nErOxVpN@2026#SuperSecretKey!XyZ
RESEND_API_KEY=re_your_resend_api_key
GOOGLE_SERVICE_ACCOUNT_JSON={}
APPLE_SHARED_SECRET=your_apple_secret
APP_URL=https://api.neroxvpn.com
GOOGLE_WEB_CLIENT_ID=595221930597-pj8dta32veg34qvtnp4u9jjlt1b51aft.apps.googleusercontent.com
GOOGLE_CLIENT_IDS=595221930597-pj8dta32veg34qvtnp4u9jjlt1b51aft.apps.googleusercontent.com
APPLE_BUNDLE_ID=org.reactjs.native.example.Nerox
APPLE_CLIENT_IDS=org.reactjs.native.example.Nerox

# Email / SMTP Configuration (Resend)
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=re_b3pjeJf4_61osZkJDATgrLGXubMYdfdfB
SMTP_FROM=noreply@neroxvpn.com

# VPN / SSH Configuration
MOCK_SSH=false
SSH_USER=root
SSH_PORT=22
SSH_PRIVATE_KEY_PATH=/root/.ssh/id_rsa

WG_ALLOWED_IPS=0.0.0.0/0
WG_DNS=8.8.8.8, 1.1.1.1

# Flutterwave LIVE Credentials
FLW_PUBLIC_KEY=FLWPUBK-38a384a63b00b73411f375f390363b20-X
FLW_SECRET_KEY=FLWSECK-a364922dcc476e36284941592f021a7b-19eae81a7eavt-X
FLW_ENCRYPTION_KEY=a364922dcc47ac94387f47be
FLUTTERWAVE_WEBHOOK_HASH=nerox_fw_webhook_a7c3e9f2b1d4
EOF

npm run build
pm2 start dist/server.js --name nerox-backend || pm2 restart nerox-backend
pm2 save
pm2 startup | tail -n 1 | bash

cat << 'EOF' > /etc/nginx/sites-available/nerox
server {
    listen 80;
    server_name api.neroxvpn.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF
ln -sf /etc/nginx/sites-available/nerox /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx

certbot --nginx -d api.neroxvpn.com --non-interactive --agree-tos -m admin@neroxvpn.com
