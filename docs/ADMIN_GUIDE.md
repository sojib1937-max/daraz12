# Admin Guide

Everything you need to run the store from the admin panel at **`/admin`**.

## 1. Signing in

1. Open `https://yourstore.ae/admin`
2. Enter your email + password (demo: `admin@desertcart.ae` / `Admin@12345`)
3. If 2FA is enabled, enter the authenticator code
4. You land on the Dashboard. Your role decides what you can see and do —
   permissions are enforced on the server, not just hidden in the menu.

**First thing after install:** change the seeded password (Admin Users → edit
yourself, or use "Forgot password"). Delete demo admins before going live.

## 2. Dashboard

- KPI cards: today's sales/orders, revenue for the selected range, COD collected,
  profit estimate, customers, products, low stock, delivered/cancelled.
- Revenue chart + orders-by-status donut.
- Funnel: visitors → product views → add to cart → checkout → orders → conversion.
- Top products + recent orders.
- **Date filter**: Today / Yesterday / Last 7 days / Last 30 days / This month.

## 3. Orders

- **Search** by order number, phone, customer name or tracking number.
- **Filter** by status, emirate, date range, flagged-only.
- Status chips at the top give one-click filtering.
- **Order detail**: items, totals, customer info, delivery address, risk flags
  (duplicate orders / high value), full status history timeline.
- **Change status**: one-click next step button, or click any status chip; add a
  note; optionally SMS the customer. Bulk status updates via checkboxes.
- **Courier + tracking number** editable inline (saved on blur).
- **Invoice / packing slip**: printable HTML (print → Save as PDF).
- **Export**: CSV with filters applied.
- **WhatsApp msg**: generates a template message and opens WhatsApp to the
  customer's number.
- **New order alerts**: bell icon rings + plays a chime in real time (SSE).
  Toggle sound in Settings → Analytics & Notifications.

## 4. Products

- **Add product**: Title (EN + AR), SKU, slug (auto), price, compare-at price
  (drives the -% badge), cost price (profit estimate only — never public),
  stock + low-stock threshold, category, brand, status (Draft/Published/Archived),
  Featured / Best Seller / Recommended flags, description (EN + AR), tags,
  shipping info (weight, dimensions, note EN + AR), specifications table,
  SEO title/description, video URL.
- **Images**: upload via Media Library or paste URLs; first image = thumbnail.
- **Variants**: size/color combos with own SKU, price delta and stock.
- **Bulk actions**: publish/unpublish/delete selected rows.
- **Import/Export CSV**: download the template, fill, paste → validated import
  with per-row errors. Export always works.
- **Duplicate** any product (creates a draft copy).

## 5. Categories & Brands

- Categories support parent/child (subcategories), Arabic names, image, sort
  order, visibility. Brand list separate. Deleting unassigns products (doesn't
  delete them).

## 6. Coupons

Types: **Percentage**, **Fixed AED**, **Free shipping**. Options: min order,
max discount, start/end dates, usage limit, per-customer limit. The storefront
validates automatically at checkout; usage counts update live.

## 7. Flash sales

Create a title (EN + AR), start/end times, and product + sale price rows. The
storefront shows a countdown automatically while the sale is live. Stock limits
and sold counters are tracked.

## 8. Reviews

Customers submit reviews (only signed-in users; verified-purchase badge when
they actually ordered). **Approve / reject / feature / delete** from the Reviews
page. Only approved reviews appear on the storefront and affect ratings.

## 9. Customers

Search by name/phone/email; columns show order count, total spend, cancellations,
last order. Detail page: contact, saved addresses, full order history, stats
(COD orders, failed deliveries) and **internal notes** (e.g. "prefers afternoon
delivery").

## 10. Media Library

Upload images (JPEG/PNG/WEBP/GIF/AVIF/SVG/ICO, ≤ 8 MB), search, copy URLs,
delete. Pick images into products from the library.

## 11. Homepage Builder

Each section (Hero, Categories, Flash Sale, Featured, Best Sellers, Trust
Badges, COD Banner, Recently Sold, Recommended, Reviews, FAQ, Newsletter) can be
**enabled/disabled, reordered, and edited** — hero image/CTA/countdown, FAQ
questions, titles in EN + AR. Changes apply to the storefront instantly.

## 12. Settings

- **Store Identity**: name (EN/AR), logo, favicon, email, phone, **WhatsApp
  number** (digits only, e.g. `971501234567`), address, hours.
- **Shipping & COD**: free-shipping threshold, minimum order, delivery estimate,
  order prefix (e.g. `DXB` → `DXB-20260824-000123`).
- **Announcement bar** (EN/AR text).
- **Popups & Social Proof**: sales popup interval/duration/max-per-day/name
  masking; discount popup code/delay/frequency; newsletter popup. Sales popups
  only ever use real (masked) orders — demo-labelled in DEMO_MODE.
- **SEO**: titles/descriptions EN + AR, keywords, OG image.
- **Social & Footer**: links + about text + copyright.
- **Checkout**: email required?, notes field on/off; theme colors.
- **Analytics & Notifications**: GA4 / Meta Pixel IDs (injected into the
  storefront), notification sound + new-order + low-stock toggles.
- **Fraud**: duplicate-order window (hours), max duplicates, high-value flag.
- **Maintenance mode**: show a "be right back" page.

## 13. Shipping zones (per-emirate fees)

Admin → **Categories & Brands** is catalog; shipping zones are in **Settings →
Shipping & COD** *plus* a dedicated API — in the UI, edit the zone list in
Settings → Shipping & COD (JSON zone list) or use Admin API
`GET/POST/PATCH/DELETE /api/admin/shipping/zones`. Fees: Dubai AED 15, other
emirates AED 25 (defaults; free shipping ≥ AED 199). Each zone supports a COD fee
too.

## 14. Admin Users & Roles

Super Admin can create admins with any role, toggle active, force password
resets (emailed link), and revoke sessions. **Enable 2FA** from your profile
(Admin → Settings → Admin Users → edit yourself → 2FA, scan the QR with Google
Authenticator).

## 15. Analytics & Abandoned Carts

Event totals (page views, product views, add-to-cart, checkout starts, orders),
a funnel visualization, and the abandoned-cart list (last 14 days) with
**"Recover via WhatsApp"** one-click outreach. Guest carts show no personal data
(privacy by design).

## 16. Audit Log

Every admin action is recorded with who/what/when/IP. Review it weekly.

## 17. Going live checklist

1. Settings → Store Identity: real name, WhatsApp, email, logo.
2. Settings → SEO: your keywords; submit sitemap in Google Search Console
   (`https://yourstore.ae/sitemap.xml`).
3. Demo mode off (`DEMO_MODE=false` in backend/.env), demo admins removed.
4. Change all passwords, enable 2FA.
5. Set your domain (see DEPLOYMENT.md §5).
6. Place a real test order → confirm the notification bell + social proof work.
