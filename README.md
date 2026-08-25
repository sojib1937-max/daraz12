# 🛍️ DesertCart — Dubai/UAE Cash-on-Delivery Dropshipping Platform

A complete, production-ready e-commerce platform built for the UAE COD market.

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + PWA |
| Backend | Node.js + TypeScript + Express 5 + Zod |
| Database | PostgreSQL 17 + Prisma ORM |
| Auth | HTTP-only session cookies + CSRF double-submit + bcrypt + optional TOTP 2FA |
| Realtime | Server-Sent Events (admin order alerts + social-proof popups) |
| Android | Capacitor 6 (same web app packaged as APK/AAB) |
| i18n | English + Arabic with full RTL layout |

---

## ✨ What's included

- **Storefront**: Home (hero, flash sale countdown, featured/best sellers/recommended, trust badges, COD banner, real social-proof, reviews, FAQ, newsletter), Shop with filters/sort/search, product pages (gallery + zoom, variants, sticky mobile CTA), cart, 3-step **Cash on Delivery checkout**, order success, order tracking timeline, about/contact/FAQ/policies, login/register/account/wishlist, Arabic (RTL) + English.
- **Admin panel** (`/admin`): dashboard with KPI cards + revenue/orders charts, orders (filters, status workflow, bulk updates, invoices, packing slips, CSV export, WhatsApp templates, risk flags), products (CRUD, duplicate, bulk, CSV import/export, variants, specs, SEO, Arabic fields), customers (stats, notes, exports), categories & brands, coupons, flash sales, review moderation, media library (validated uploads), homepage builder, settings (shipping/COD/popups/SEO/social/analytics…), admin users with 6 RBAC roles, audit log, analytics + abandoned carts, real-time notifications with sound.
- **Trust & safety**: real social-proof only (masked, demo-labelled in DEMO_MODE), fraud/duplicate-order flags, rate limiting, CSRF, input validation everywhere, no secrets in the frontend, audit logging.
- **PWA**: installable, offline fallback, manifest + icons.
- **Android**: Capacitor project with icons/splash — `apk:debug`, `apk:release`, `aab` build scripts.

## 🚀 Quick start (local development)

```bash
# 1. Prerequisites: Node 20+, PostgreSQL 15+
createdb desertcart          # or via your Postgres admin

# 2. Configure the backend
cp backend/.env.example backend/.env
#    edit backend/.env → DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/desertcart

# 3. Install + migrate + seed
npm install
npm run db:migrate           # applies Prisma migrations
npm run db:seed              # demo data (clearly labelled DEMO)

# 4. Run
npm run dev                  # backend :4000 + frontend :5173
```

Open **http://localhost:5173** (store) and **http://localhost:5173/admin** (admin).

### Demo credentials (DEMO ONLY — change before production)

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@desertcart.ae` | `Admin@12345` |
| Manager | `manager@desertcart.ae` | `Manager@12345` |
| Order Manager | `orders@desertcart.ae` | `Orders@12345` |
| Viewer | `viewer@desertcart.ae` | `Viewer@12345` |
| Storefront customer | phone `0501234567` (guest checkout — no password needed) | |

> `DEMO_MODE=true` is set in `backend/.env`. Every demo order, review and popup is
> labelled **DEMO**. Set `DEMO_MODE=false` in production so only real orders feed
> the social-proof popups.

## 📚 Documentation

| File | What it covers |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | Full installation, database, seed, day-to-day commands |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment, domain/DNS/SSL, backup & recovery |
| [docs/ANDROID_BUILD.md](docs/ANDROID_BUILD.md) | APK/AAB builds, signing, Play Store preparation |
| [docs/SECURITY.md](docs/SECURITY.md) | Security model, audit results, hardening checklist |
| [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) | Admin manual: products, orders, COD, shipping, coupons, homepage… |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | Every environment variable explained |
| [docs/BACKUP.md](docs/BACKUP.md) | Database + media backup & restore procedures |

## 🧪 Tests

```bash
npm test                     # 50 backend tests: auth, RBAC, products, checkout, coupons, shipping, security
```

## 🏗 Project structure

```
/backend          Express API + Prisma schema + seed + tests
/frontend         React storefront + admin panel + PWA
/mobile           Capacitor Android project (icons, splash, gradle)
/docs             All documentation
/scripts          Operational helpers (backup, create-admin)
```

## ⚖️ License

Proprietary — built for your store. No warranty, use at your own risk.
