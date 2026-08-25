# Environment Variables Reference

All secrets live in `backend/.env` (never committed). The frontend only receives
public-safe values (`VITE_*`); nothing sensitive is ever bundled into JavaScript.

## Backend (`backend/.env`)

### Core
| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `production` enables JSON logs, prod cookie policy |
| `PORT` | `4000` | API port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `APP_URL` | `http://localhost:5173` | Public store URL (used for emails, sitemap, links) |
| `API_URL` | `http://localhost:4000` | Public API URL (used for uploaded-media URLs) |
| `ALLOWED_ORIGINS` | `http://localhost:5173,…` | CORS allowlist (dev). Same-origin in prod |
| `ADMIN_BASE_PATH` | `/admin` | Admin UI route — change to obscure/rename if desired (auth still required!) |

### Security
| Variable | Default | Purpose |
|---|---|---|
| `SESSION_SECRET` | dev value | **Generate: `openssl rand -hex 64`** |
| `COOKIE_SECURE` | `false` | `true` in production (HTTPS-only cookies) |
| `COOKIE_SAME_SITE` | `lax` | Cookie SameSite policy |
| `ADMIN_SESSION_DAYS` | `3` | Admin session lifetime |
| `CUSTOMER_SESSION_DAYS` | `30` | Customer session lifetime |
| `RESET_TOKEN_MINUTES` | `30` | Password-reset token lifetime |
| `DEMO_MODE` | `true` | `true` = demo data labelled everywhere; `false` = production behaviour |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | demo values | Credentials created by `db:seed` |

### Media storage
| Variable | Default | Purpose |
|---|---|---|
| `STORAGE_DRIVER` | `local` | `local` (disk) or `s3` (S3-compatible) |
| `STORAGE_LOCAL_DIR` | `uploads` | Local uploads folder |
| `STORAGE_BASE_URL` | `/uploads` | Public path prefix |
| `UPLOAD_MAX_MB` | `8` | Max upload size per file |
| `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL` | — | Required when `STORAGE_DRIVER=s3` (AWS S3, Cloudflare R2, DO Spaces…) |

### Notifications
| Variable | Default | Purpose |
|---|---|---|
| `EMAIL_DRIVER` | `console` | `console` (logs) or `smtp` |
| `EMAIL_FROM` | DesertCart <no-reply@…> | Sender address |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | — | SMTP credentials for `smtp` driver |
| `SMS_DRIVER` | `console` | `console` or `http` |
| `SMS_WEBHOOK_URL`, `SMS_API_KEY`, `SMS_FROM` | — | Generic SMS provider webhook (Twilio etc.) — POST `{to, from, message}` with `Authorization: Bearer <key>` |
| `WHATSAPP_DRIVER` | `console` | `console` or `http` |
| `WHATSAPP_WEBHOOK_URL`, `WHATSAPP_API_KEY` | — | WhatsApp Business API / provider webhook — POST `{to, message}` |

### Analytics
| Variable | Default | Purpose |
|---|---|---|
| `ANALYTICS_GA_ID` | — | Google Analytics 4 ID (injected into storefront `<head>`) |
| `ANALYTICS_META_PIXEL_ID` | — | Meta Pixel ID (injected into storefront `<head>`) |

> These are public-safe IDs (also editable in Admin → Settings). Real access
> tokens never belong in the frontend.

### Rate limiting
| Variable | Default |
|---|---|
| `RATE_LIMIT_WINDOW_MS` | `900000` (15 min) |
| `RATE_LIMIT_GLOBAL_MAX` | `600` requests/window/IP |
| `RATE_LIMIT_AUTH_WINDOW_MS` | `900000` |
| `RATE_LIMIT_AUTH_MAX` | `15` logins/window/IP |
| `RATE_LIMIT_ORDER_MAX` | `10` orders/10 min/IP |

### Fraud defaults (also editable in Admin → Settings)
| Variable | Default |
|---|---|
| `FRAUD_DUPLICATE_WINDOW_HOURS` | `6` |
| `FRAUD_DUPLICATE_MAX_ORDERS` | `2` |

## Frontend (`frontend/.env.local` — optional)

| Variable | Default | Purpose |
|---|---|---|
| `VITE_ADMIN_PATH` | `/admin` | Admin route base (must match backend `ADMIN_BASE_PATH` for cookie path if changed) |
| `VITE_API_TARGET` | `http://127.0.0.1:4000` | Dev/preview proxy target for `/api` and `/uploads` |

Only `VITE_`-prefixed variables are exposed to the browser — by Vite's design.
Secrets (DB, SMTP, S3, provider keys) can never reach the client.

## Mobile (`mobile/capacitor.config.ts` + env)

| Variable | Default | Purpose |
|---|---|---|
| `ANDROID_APP_ID` | `com.desertcart.app` | Package name (set before release) |
| `ANDROID_APP_NAME` | `DesertCart` | Launcher name |
| `CAP_WEB_DIR` | `../frontend/dist` | Bundled web build |

## Database / misc

- `DATABASE_URL` supports `?sslmode=require` for managed Postgres.
- `LOG_LEVEL` (optional): `debug|info|warn|error`.
- Never put real credentials in `.env.example`, READMEs, or commit `.env`.
