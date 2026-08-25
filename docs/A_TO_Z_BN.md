# Virexamart — A TO Z (সহজ, ছোট, সোজা)

কোথায় কী বসবে:
- **ব্যাকএন্ড (API + ডাটাবেস)** → Render (ফ্রি)
- **ফ্রন্টএন্ড (ওয়েবসাইট)** → Netlify (ফ্রি)

---

## ধাপ ১: GitHub অ্যাকাউন্ট খুলুন
1. github.com → Sign up → ফ্রি
2. **New repository** → নাম: `virexamart` → Public → Create

## ধাপ ২: ZIP-এর ফাইল GitHub-এ আপলোড
1. ZIP খুলে আনজিপ করুন
2. GitHub রিপোর ভেতরে ঢুকে **Add file → Upload files**
3. সব ফাইল-ফোল্ডার টেনে ফেলুন → **Commit changes**

## ধাপ ৩: Render-এ ব্যাকএন্ড (এটা আগে)
1. **render.com** → Sign up (GitHub দিয়ে)
2. **New + → Web Service** → আপনার `virexamart` রিপো বাছুন
3. নিচের ৩টা ঠিক করুন:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Plan: **Free**
4. **Neon.tech** খুলুন → ফ্রি PostgreSQL → Singapore → Connection string কপি
5. Render-এ **Environment Variables** এ বসান:

```
NODE_ENV=production
DATABASE_URL=<নিয়ন থেকে কপি করা>
APP_URL=https://virexamart.onrender.com
API_URL=https://virexamart.onrender.com
SESSION_SECRET=ekta-lomba-poripurna-random-string
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
DEMO_MODE=false
ADMIN_BASE_PATH=/admin
```

6. **Create Web Service** → ৫ মিনিট অপেক্ষা
7. URL পাবেন: `https://virexamart.onrender.com` → **এই URL টা কপি করে রাখুন**

## ধাপ ৪: Netlify-তে ফ্রন্টএন্ড
1. **app.netlify.com** → Sign up (GitHub দিয়ে)
2. **Add new site → Import from GitHub** → `virexamart` রিপো বাছুন
3. Netlify নিজেই `netlify.toml` পড়ে নেবে — কিছু বদলানোর দরকার নেই
4. **Environment Variables** এ বসান:
```
API_URL=https://virexamart.onrender.com
```
5. **Deploy** → ২-৩ মিনিট

## ধাপ ৫: শেষ
- সাইট: `https://আপনারনেম.netlify.app`
- অ্যাডমিন: `https://আপনারনেম.netlify.app/admin`
- লগইন: `admin@desertcart.ae` / `Admin@12345` → **পাসওয়ার্ড বদলান!**

## দরকারি কমান্ড (শুধু নিজের কম্পিউটারে কাজ করতে চাইলে)
```bash
npm install          # ডিপেন্ডেন্সি
npm run dev          # লোকাল চালু
npm run build        # বিল্ড
npm start            # প্রোডাকশন সার্ভার
npm test             # টেস্ট
```
