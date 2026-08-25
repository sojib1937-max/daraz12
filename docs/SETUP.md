# Setup Guide

Complete local installation and day-to-day commands.

## 1. Prerequisites

- **Node.js ≥ 20** (`node -v`)
- **npm ≥ 10**
- **PostgreSQL ≥ 15** running locally (or any PostgreSQL URL, e.g. Neon/Supabase for testing)

## 2. Database

```bash
# create the database + user (adjust to your Postgres setup)
sudo -u postgres psql -c "CREATE USER desertcart WITH PASSWORD 'CHANGE_ME';"
sudo -u postgres psql -c "CREATE DATABASE desertcart OWNER desertcart;"
```

## 3. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env — at minimum set DATABASE_URL and SESSION_SECRET
```

| Variable | Example |
|---|---|
| `DATABASE_URL` | `postgresql://desertcart:CHANGE_ME@127.0.0.1:5432/desertcart?schema=public` |
| `SESSION_SECRET` | `openssl rand -hex 64` output |
| `DEMO_MODE` | `true` for development (labels all demo data), `false` in production |

### Migrations & seed

```bash
npm run db:migrate        # prisma migrate dev — creates the schema (dev)
npm run db:seed           # demo data: 12 products, 7 categories, orders, coupons, admins…
```

> For production use `npm run db:migrate:prod` (prisma migrate deploy) — never `db:migrate` on prod.

### Run

```bash
npm run dev               # tsx watch on :4000
npm run build             # tsc → dist/
npm start                 # node dist/index.js
npm test                  # vitest — 50 integration tests
```

## 4. Frontend

```bash
cd frontend
npm install
npm run dev               # Vite on :5173, proxies /api + /uploads to :4000
npm run build             # tsc + vite build → dist/ (with PWA service worker)
npm run preview           # serve the production build
```

`VITE_ADMIN_PATH` (default `/admin`) and `VITE_API_TARGET` (default `http://127.0.0.1:4000`)
can be set in `frontend/.env.local` — see `frontend/.env.example`.

## 5. Root commands

```bash
npm run dev            # backend + frontend together
npm run build          # build both
npm test               # backend tests
npm run db:migrate     # apply migrations (dev)
npm run db:seed        # demo seed
```

## 6. First login

1. Open http://localhost:5173/admin
2. Sign in with `admin@desertcart.ae` / `Admin@12345`
3. **Immediately change the password** (admin menu → change password, or via
   Settings → Admin Users) — the seeded credentials are public and DEMO-only.
4. Configure your store: Settings → Store Identity (name, WhatsApp number, email),
   Shipping & COD, Announcement.

## 7. Verification checklist

- [ ] Storefront loads at `/`
- [ ] Search works (`/search?q=blender`)
- [ ] Product page shows gallery, variants, stock, COD info
- [ ] Add to cart → checkout → place COD order → success page with order number
- [ ] Order appears in Admin → Orders (with real-time notification + sound)
- [ ] Track order at `/track-order` with order ID + phone
- [ ] Admin can change status → tracking timeline updates
- [ ] Switch to العربية — full RTL layout
- [ ] `npm test` → 50/50 pass
