# Real WireGuard Backend Deploy

Use this flow for the first real VPN test without mobile native integration.

## 1. Server prerequisites

Run these on the backend server:

```bash
ssh root@162.243.197.241
ssh -i /root/.ssh/id_rsa root@64.23.142.203 "wg show"
```

That SSH test must work for every VPN node.

## 2. Database setup

For a fresh standalone PostgreSQL database:

```bash
createdb nerox_vpn
psql -d nerox_vpn -f ../schema.sql
psql -d nerox_vpn -f ../migrations/65_real_wireguard_backend.sql
```

If the database already exists, run only:

```bash
psql -d nerox_vpn -f ../migrations/65_real_wireguard_backend.sql
```

## 3. Backend env

```bash
cd backend
cp .env.example .env
nano .env
```

Required production values:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:password@localhost:5432/nerox_vpn
JWT_SECRET=long_random_secret
SSH_PRIVATE_KEY_PATH=/root/.ssh/id_rsa
WG_INTERFACE=wg0
WG_ALLOWED_IPS=0.0.0.0/0
```

## 4. Run backend

```bash
cd backend
npm install
npm run build
npm start
```

For PM2:

```bash
npm install -g pm2
pm2 start dist/server.js --name nerox-backend
pm2 save
```

## 5. API test

```bash
curl http://localhost:5000/health
```

Register or login, then use the returned JWT:

```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:5000/api/servers
```

Start a real WireGuard session:

```bash
curl -X POST http://localhost:5000/api/sessions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serverId":"SERVER_ID"}'
```

The response returns a raw WireGuard config in `config`. Import that config into
the WireGuard client and connect.

Disconnect:

```bash
curl -X PUT http://localhost:5000/api/sessions/SESSION_ID \
  -H "Authorization: Bearer TOKEN"
```
