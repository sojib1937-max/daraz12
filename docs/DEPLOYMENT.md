# Deployment Guide

Production deployment: build, migrate, run, domain/DNS/SSL, backups, and recovery.

## 1. Architecture in production

```
Internet
   │
   ▼
Domain (www.yourstore.ae) ──► CDN/HTTPS (Cloudflare, or your host's TLS)
   │
   ▼
Reverse proxy (nginx / Caddy / Render / Railway / Fly.io…)
   ├── /            → frontend static files (frontend/dist)
   ├── /api/*       → backend (Node on :4000)
   ├── /uploads/*   → backend (media storage)
   ├── /sitemap.xml → backend
   └── /robots.txt  → backend
   │
   ▼
PostgreSQL (managed: Neon, Supabase, RDS, DigitalOcean…)
```

Two supported topologies:

- **A. Single Node server** (VPS, Render, Railway, Fly.io): the backend already
  serves `frontend/dist` when it exists (see `backend/src/app.ts`). One process,
  one domain, zero CORS issues.
- **B. Split hosting** (static CDN + API): build the frontend, upload `frontend/dist`
  to Vercel/Netlify/Cloudflare Pages, and run the backend separately. Configure
  `APP_URL` and `ALLOWED_ORIGINS` on the backend. All API calls are same-origin
  through a rewrite (`/api/*` → backend), so cookies work unchanged.

## 2. Environment (production)

Copy `backend/.env.example` and set **at minimum**:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASS@HOST:5432/db?sslmode=require
APP_URL=https://www.yourstore.ae
API_URL=https://www.yourstore.ae            # same origin in topology A
SESSION_SECRET=<openssl rand -hex 64>
COOKIE_SECURE=true
DEMO_MODE=false
ADMIN_BASE_PATH=/admin                      # or a custom path
STORAGE_DRIVER=local                        # or s3 (see ENVIRONMENT.md)
EMAIL_DRIVER=smtp                           # + SMTP_* vars
SMS_DRIVER=http                             # + SMS_WEBHOOK_URL
WHATSAPP_DRIVER=http                        # + WHATSAPP_WEBHOOK_URL
```

Never commit real values — `.env` is gitignored.

## 3. Build & deploy steps (topology A, single server)

```bash
# 1. Install
npm ci

# 2. Migrate (NOT prisma migrate dev!)
cd backend && npx prisma migrate deploy

# 3. Seed only once (optional, demo data is DEMO-labelled)
npm run db:seed

# 4. Create your real admin
npx tsx scripts/create-admin.ts you@yourstore.ae "Your Name" SUPER_ADMIN
#    (prompts for a password; or set one via env)

# 5. Build
npm run build            # backend dist/ + frontend dist/

# 6. Run
NODE_ENV=production npm start   # serves API + frontend on :4000
```

Run the backend under a process manager:

```bash
# systemd unit example (/etc/systemd/system/desertcart.service)
[Service]
WorkingDirectory=/opt/desertcart
ExecStart=/usr/bin/node backend/dist/index.js
Restart=always
Environment=NODE_ENV=production
EnvironmentFile=/opt/desertcart/backend/.env
```

## 4. nginx (single server)

```nginx
server {
    listen 80;
    server_name yourstore.ae www.yourstore.ae;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourstore.ae www.yourstore.ae;

    ssl_certificate     /etc/letsencrypt/live/yourstore.ae/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourstore.ae/privkey.pem;

    client_max_body_size 10m;                 # uploads (max 8 MB per file)

    location / {
        proxy_pass http://127.0.0.1:4000;     # backend serves API + frontend
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;                  # required for SSE notifications
        proxy_cache off;
        add_header Cache-Control "no-store";
    }
}
```

> `proxy_buffering off` is **required** — the admin panel and sales popups use
> Server-Sent Events (`/api/admin/notifications/events`, `/api/events/sales`).

## 5. Domain / DNS / HTTPS

| Record | Type | Value |
|---|---|---|
| `yourstore.ae` | A | your server IPv4 |
| `www.yourstore.ae` | CNAME | `yourstore.ae` (or A record to the same IP) |
| `api.yourstore.ae` (optional split) | A | your server IPv4 |

- **SSL**: `certbot --nginx -d yourstore.ae -d www.yourstore.ae` (Let's Encrypt) or your host's managed TLS. Always redirect HTTP → HTTPS (shown above).
- **WWW → root**: the nginx config above answers both; pick one canonical host in
  `APP_URL` (recommend `https://www.yourstore.ae`). Both must resolve — no hardcoded domains anywhere in the code.
- **Admin**: `https://www.yourstore.ae/admin` (path configurable via `ADMIN_BASE_PATH`).
- Verify: `curl -I https://www.yourstore.ae/sitemap.xml` → 200 XML.

## 6. Managed Postgres (Neon / Supabase / RDS)

1. Create the database.
2. Run `npx prisma migrate deploy` with the production `DATABASE_URL`.
3. Connection strings with `sslmode=require` work out of the box.
4. Recommended: enable point-in-time recovery / daily snapshots on the provider.

## 7. Backup & recovery

See [BACKUP.md](BACKUP.md) for scripts and procedures. Summary:

```bash
# Daily (cron) — database
pg_dump "$DATABASE_URL" | gzip > backups/db-$(date +%F).sql.gz

# Media
rsync -a backend/uploads/ backups/uploads/

# Restore
gunzip -c backups/db-2026-08-24.sql.gz | psql "$DATABASE_URL"
```

Keep at least 14 daily backups, offsite (S3-compatible bucket or second server).

## 8. Post-deploy checklist

- [ ] `DEMO_MODE=false` — social proof shows only real orders
- [ ] `COOKIE_SECURE=true`, long `SESSION_SECRET`
- [ ] Admin password changed; demo admins (`manager@…`, `orders@…`, `viewer@…`) deleted
- [ ] WhatsApp number set in Settings (store.whatsapp)
- [ ] SMTP/webhook credentials configured if you want email/SMS/WhatsApp sends
- [ ] HTTPS enforced, HTTP redirects, `www` canonical
- [ ] `proxy_buffering off` for SSE
- [ ] `npm test` green, `npm run build` green
- [ ] Backups scheduled and tested with a restore drill
- [ ] Analytics IDs added in Settings → Analytics (GA4 / Meta Pixel) if used
