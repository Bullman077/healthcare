# UHS Healthcare — Production Deployment Guide

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│  CDN/Cloud   │────▶│   Nginx      │
│  (client)    │     │  (Cloudflare)│     │  (reverse    │
└──────────────┘     └──────────────┘     │   proxy)     │
                                          │              │
                                          │  ┌──────────┐│
                                          │  │  Node.js  ││
                                          │  │  (PM2)    ││
                                          │  └────┬─────┘│
                                          │       │       │
                                          │  ┌────▼─────┐│
                                          │  │PostgreSQL││
                                          │  │          ││
                                          │  └──────────┘│
                                          └──────────────┘
```

- **Frontend**: Static HTML/CSS/JS → served by Nginx → cached by Cloudflare
- **Backend**: Node.js (Express) → managed by PM2 (cluster mode) → behind Nginx reverse proxy
- **Database**: PostgreSQL (via Sequelize ORM)
- **Email**: SendGrid / Amazon SES / Mailgun
- **SSL**: Let's Encrypt (via Certbot) or Cloudflare Edge Certificates

---

## 1. PostgreSQL Setup

1. Install PostgreSQL 14+ on your server: `sudo apt install -y postgresql postgresql-contrib`
2. Create a database and user:
   ```bash
   sudo -u postgres psql
   CREATE USER uhs_admin WITH PASSWORD 'your_secure_password';
   CREATE DATABASE uhs_healthcare OWNER uhs_admin;
   GRANT ALL PRIVILEGES ON DATABASE uhs_healthcare TO uhs_admin;
   \q
   ```
3. Set this as `DATABASE_URL` in `.env.production`

```
DATABASE_URL=postgresql://uhs_admin:your_secure_password@localhost:5432/uhs_healthcare
```

---

## 2. Email Service (SendGrid)

1. Create a [SendGrid](https://sendgrid.com) account (free: 100 emails/day)
2. Create an **API Key** with "Full Access" or "Mail Send"
3. Verify a **Sender Identity** (single sender or domain)
4. Configure in `.env.production`:

```
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=SG.your_sendgrid_api_key
EMAIL_FROM=noreply@uhshealthcare.com
```

Alternatives: [Amazon SES](https://aws.amazon.com/ses/), [Mailgun](https://mailgun.com)

---

## 3. Domain & DNS (Cloudflare)

1. Add your domain to [Cloudflare](https://dash.cloudflare.com)
2. Update nameservers at your registrar to point to Cloudflare
3. Create DNS records:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `YOUR_SERVER_IP` (proxied) |
| CNAME | `www` | `uhshealthcare.com` (proxied) |

4. In **SSL/TLS** → **Overview**: set to **Full (strict)**
5. In **SSL/TLS** → **Edge Certificates**: enable **Always Use HTTPS**

---

## 4. Server Setup (Ubuntu 22.04)

### Initial Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx certbot python3-certbot-nginx

# Verify
node -v   # v20.x.x
npm -v    # 10.x.x
```

### Clone & Build
```bash
# Clone repo
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
git clone https://github.com/yourorg/uhs-healthcare.git /var/www/uhshealthcare
cd /var/www/uhshealthcare

# Install dependencies
npm install
cd backend && npm install && cd ..

# Build frontend assets
npm run build

# Set up environment
cp backend/.env.production backend/.env
nano backend/.env   # Fill in real values

# Seed database
npm run seed
```

---

## 5. SSL Certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d uhshealthcare.com -d www.uhshealthcare.com
```

Auto-renewal is enabled by default. Test with:
```bash
sudo certbot renew --dry-run
```

---

## 6. Nginx Configuration

```bash
# Copy config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/uhs
sudo ln -s /etc/nginx/sites-available/uhs /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. PM2 Process Manager

```bash
# Install PM2 globally
npm install -g pm2

# Start the API
pm2 start ecosystem.config.js --env production

# Save PM2 process list (auto-restart on reboot)
pm2 save
pm2 startup   # Follow the instructions printed
```

### Useful PM2 commands
```bash
pm2 status                    # List processes
pm2 logs uhs-api              # View logs
pm2 restart uhs-api           # Restart
pm2 reload ecosystem.config.js --env production   # Graceful reload
pm2 monit                     # Monitor CPU/memory
```

---

## 8. Firewall (UFW)

```bash
sudo ufw allow 22/tcp           # SSH
sudo ufw allow 80/tcp           # HTTP
sudo ufw allow 443/tcp          # HTTPS
sudo ufw --force enable
sudo ufw status
```

---

## 9. Verify Deployment

```bash
# Check services
curl -I https://uhshealthcare.com                    # Should return 200
curl https://uhshealthcare.com/api/health            # Should return JSON
curl https://uhshealthcare.com/admin/                # Should load dashboard

# Check logs
pm2 logs uhs-api
sudo tail -f /var/log/nginx/uhs-access.log
```

---

## 10. Deploy Updates

### Automated (via GitHub Actions)
Push to `main` branch → GitHub Actions runs:
1. Lint HTML
2. Build frontend assets
3. Rsync to server
4. Install backend deps
5. Reload PM2 + Nginx

### Manual
```bash
cd /var/www/uhshealthcare
git pull origin main
npm run build
cd backend && npm ci --only=production && cd ..
pm2 startOrReload ecosystem.config.js --env production
sudo systemctl reload nginx
```

---

## 11. Performance Checklist

- [ ] Cloudflare proxying enabled (DNS orange cloud)
- [ ] Brotli compression enabled (Cloudflare + Nginx)
- [ ] Static assets cached (1 year, immutable)
- [ ] HTML not cached (always fresh)
- [ ] Images optimized (WebP with JPEG fallback)
- [ ] Lazy loading enabled (IntersectionObserver)
- [ ] Scripts deferred (no render blocking)
- [ ] Google Fonts preloaded + preconnected
- [ ] CSS minified + single bundle
- [ ] JS minified + tree-shaken
- [ ] PostgreSQL indexes in place
- [ ] Rate limiting active (100 req/15min global, 10 req/15min auth)
- [ ] HTTPS enforced (redirect + HSTS)
- [ ] Gzip compression active

---

## 12. Monitoring

```bash
# Server health
htop                                     # CPU / memory
df -h                                    # Disk usage
sudo journalctl -u nginx --no-pager -n50 # Nginx errors
pm2 monit                                # Process metrics

# API health endpoint
curl https://uhshealthcare.com/api/health

# Response time
curl -w "DNS: %{time_namelookup}s, Connect: %{time_connect}s, SSL: %{time_appconnect}s, TTFB: %{time_starttransfer}s, Total: %{time_total}s\n" -o /dev/null -s https://uhshealthcare.com
```

---

## 13. Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | API port (default 5000) |
| `NODE_ENV` | Yes | `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | 64-char hex key for JWT signing |
| `COOKIE_SECRET` | Yes | 64-char hex key for cookie signing |
| `ADMIN_EMAIL` | Seed only | Default admin email |
| `ADMIN_PASSWORD` | Seed only | Default admin password |
| `EMAIL_HOST` | Yes | SMTP host (e.g., `smtp.sendgrid.net`) |
| `EMAIL_PORT` | Yes | SMTP port (587) |
| `EMAIL_USER` | Yes | SMTP username |
| `EMAIL_PASS` | Yes | SMTP password |
| `EMAIL_FROM` | Yes | From address for emails |
| `FRONTEND_URL` | Yes | `https://uhshealthcare.com` |
| `TRUST_PROXY` | Yes | `1` when behind Nginx/Cloudflare |

---

## 14. Platform-Specific Deployments

### Render (simplest)
1. Create a **Web Service** pointing to `./backend`
2. Set build command: `npm install`
3. Set start command: `node server.js`
4. Add environment variables from `.env.production`
5. Create a **Static Site** pointing to root for frontend

### Railway
1. `railway login`
2. `railway init`
3. Add environment variables
4. `railway up`

### Docker
```bash
docker build -t uhs-healthcare .
docker run -d -p 80:80 -p 443:443 --env-file backend/.env uhs-healthcare
```
