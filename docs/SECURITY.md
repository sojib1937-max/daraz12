# Security Guide

How the platform is secured, what was audited, and the production hardening checklist.

## Security model

### Authentication
- **Customers**: phone + bcrypt-hashed password. Sessions are opaque random
  tokens (32 bytes) stored **hashed (SHA-256)** in the DB, delivered in
  **HTTP-only, SameSite=Lax cookies**. No tokens in localStorage, nothing
  readable by JavaScript.
- **Admins**: same session model + server-side session table (revocable,
  expiring, audited). **Optional TOTP 2FA** (speakeasy) with QR enrollment.
- **Password resets**: short-lived (30 min), single-use tokens stored only as
  hashes. The API never reveals whether an email/phone exists.

### Authorization (RBAC)
- Roles: SUPER_ADMIN, ADMIN, MANAGER, ORDER_MANAGER, PRODUCT_MANAGER, VIEWER.
- Permissions are **enforced in backend middleware on every admin route**
  (`requirePermission`) — hiding buttons in the UI is only cosmetic.
- Demo users seeded for every role; the super admin can create/delete admins,
  and password changes revoke all existing sessions.

### Request protection
- **CSRF**: double-submit cookie pattern — every state-changing request must
  echo the `dc_csrf` cookie value in `X-CSRF-Token`; SameSite=Lax as second layer.
- **Rate limiting** (express-rate-limit): global API limit, aggressive limits on
  login (15/15min, with lockout messaging), orders (10/10min), forms (10/h).
- **Validation**: Zod schemas on every body/query — type-safe, no raw input.
- **Headers**: helmet (HSTS, X-Content-Type-Options, frame protection…),
  `X-Request-Id` on every response for support forensics.
- **SQL injection**: Prisma parameterized queries only — no string-built SQL in
  application code.
- **XSS**: React escapes output by default; CSP is left to the reverse proxy
  (documented in DEPLOYMENT.md); uploaded SVGs are served with
  `X-Content-Type-Options: nosniff`; no `dangerouslySetInnerHTML` anywhere.

### Data exposure
- **Cost prices** are admin-only (never serialized to public APIs).
- **Order tracking** requires order number + phone, and returns no address/PII.
- **Social proof** broadcasts masked data only (`A**** H****`, emirate, product).
- **Demo mode**: every demo record is flagged `isDemo`; popups show a DEMO badge;
  with `DEMO_MODE=false` demo events are excluded from the storefront stream.
- **Error responses** never include stack traces, SQL, or internal paths —
  verified by tests (`tests/catalog.test.ts` asserts no `at ` / `node_modules`
  in 404 bodies).
- **Logs** redact tokens/passwords/keys before writing.

### Uploads
- MIME + extension + size validation (≤ 8 MB), magic-byte storage driver,
  `nosniff`, content hash filenames, no execution of uploaded files, separate
  media table for audit. `validateImageFile()` in `backend/src/lib/storage`.

### Anti-abuse
- Duplicate COD order detection (same phone + identical items within a window)
  → **flags, never auto-rejects**; window/count configurable in Settings → Fraud.
- UAE phone normalization + validation everywhere.
- `trust proxy` aware IP capture for audit + rate limiting.

## Audit log
Every sensitive action is recorded: `ADMIN_LOGIN`, `PRODUCT_CREATED/UPDATED/DELETED`,
`ORDER_STATUS_CHANGED`, `COUPON_CREATED`, `SETTINGS_CHANGED`, `ADMIN_USER_CREATED…`
with admin, entity, details, IP and timestamp (Admin → Audit Log).

## What was verified (automated tests)

`npm test` covers:
- wrong-password and unknown-account return identical errors (no enumeration)
- CSRF missing → 403
- admin API without session → 401
- VIEWER role blocked from products/settings creation → 403
- no stack traces in error responses
- XSS payloads stored as inert data
- checkout totals, coupons, shipping zones, stock decrement, fraud flags
- tracking without PII leakage

## Production hardening checklist

- [ ] `DEMO_MODE=false`
- [ ] `COOKIE_SECURE=true` (HTTPS only)
- [ ] `SESSION_SECRET` = 64 random bytes; rotate after any admin compromise
- [ ] Default demo admins deleted; real admins use 2FA
- [ ] HTTPS enforced at the proxy; HSTS on (helmet sets it when behind TLS)
- [ ] `proxy_buffering off` for SSE endpoints
- [ ] Uploads limited (already 8 MB) and storage driver = S3 in production
- [ ] Keep Postgres credentials least-privilege (no superuser)
- [ ] Monitor audit log for `ADMIN_LOGIN` anomalies
- [ ] Backups encrypted/offsite (see BACKUP.md)
- [ ] Do not expose `/admin` in robots.txt links or sitemaps (already excluded)

## Reporting issues
Contact the developer with the request ID (`X-Request-Id` header) and time —
logs are structured JSON in production.
