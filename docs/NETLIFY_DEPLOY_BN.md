# Virexamart — Netlify-এ হোস্ট করার সহজ গাইড (বাংলা)

Netlify-তে আপনার **ফ্রন্টএন্ড** হোস্ট হবে (দ্রুত, ফ্রি, SSL সহ)। API-র জন্য আগে
**ব্যাকএন্ড Render-এ ফ্রি** ডিপ্লয় করতে হবে (নিচের ধাপ ১)।

---

## ধাপ ১ — আগে ব্যাকএন্ড ডিপ্লয় করুন (Render ফ্রি)
`docs/FREE_HOSTING_BN.md`-এর ধাপ অনুসরণ করুন:
1. Neon-এ ফ্রি PostgreSQL (সিঙ্গাপুর রিজিয়ন)
2. Render-এ Web Service: `npm install && npm run build` / `npm start` + Environment Variables
3. মনে রাখুন আপনার ব্যাকএন্ড URL — যেমন `https://virexamart.onrender.com`

## ধাপ ২ — GitHub-এ পুশ করুন
```bash
cd /home/user
git init
git add .
git commit -m "Virexamart"
git remote add origin https://github.com/আপনারনেম/virexamart.git
git push -u origin main
```

## ধাপ ৩ — Netlify-তে ডিপ্লয়
1. **app.netlify.com** → GitHub দিয়ে Sign up
2. **Add new site → Import an existing project** → আপনার রিপো বাছুন
3. Netlify `netlify.toml` ফাইল নিজেই পড়ে নেবে:
   - Build command: `npm ci && npm run build -w frontend`
   - Publish directory: `frontend/dist`
4. **Environment variables** (Site settings → Environment variables):
   ```
   API_URL = https://virexamart.onrender.com
   ```
5. **Deploy** চাপুন — ২-৩ মিনিটে লাইভ! 🎉

## ধাপ ৪ — ফলাফল
- সাইট: `https://আপনারনেম.netlify.app`
- `/api/*` কল → Netlify → আপনার Render ব্যাকএন্ডে যায় (Redirects অটো)
- অ্যাডমিন: `https://আপনারনেম.netlify.app/admin`

> ⚠️ ব্যাকএন্ডের `.env`-এ `ALLOWED_ORIGINS`-এ Netlify ডোমেইন যোগ করুন (কমা দিয়ে)।
> আর Render-এ `DEMO_MODE=false` রাখতে ভুলবেন না!

## সমস্যা হলে
- **অর্ডার যায় না** → Render সার্ভার ঘুমিয়ে থাকলে প্রথমবার ৩০-৬০ সেকেন্ড লাগে — UptimeRobot-এ পিং দিন
- **ছবি না আসে** → `/uploads/*` রিডাইরেক্ট চেক করুন (netlify.toml-এ আছে)
- **CORS এরর** → Render-এ `ALLOWED_ORIGINS` ঠিক করুন
