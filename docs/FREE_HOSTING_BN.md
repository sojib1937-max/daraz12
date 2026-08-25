# 🆓 Virexamart — সম্পূর্ণ ফ্রিতে হোস্টিং করার গাইড (বাংলা)

টাকার বিনিময় ছাড়াই আপনার স্টোর লাইভ করা যায়। ৩টা জিনিস লাগবে — **ফ্রন্টএন্ড, ব্যাকএন্ড, ডাটাবেস** — আর প্রতিটির জন্য ফ্রি সার্ভিস আছে।

---

## 🏆 সবচেয়ে সহজ উপায়: Render ফ্রি টিয়ার (১টাই সার্ভিসে সব)

আমাদের সিস্টেম এমন বানানো যে **একটা সার্ভিসেই সব চলে** (ব্যাকএন্ড নিজেই ফ্রন্টএন্ডও সার্ভ করে)। তাই শুধু **Render**-এ একটা ওয়েব সার্ভিস = পুরো স্টোর!

### ধাপ ১ — প্রজেক্ট GitHub-এ পুশ করুন
```bash
cd /home/user
git init
git add .
git commit -m "Virexamart full platform"
# GitHub-এ নতুন রিপোজিটরি খুলে:
git remote add origin https://github.com/আপনারনেম/virexamart.git
git push -u origin main
```

### ধাপ ২ — ফ্রি PostgreSQL নিন (Neon)
1. **https://neon.tech** → Sign up (ফ্রি)
2. Create Project → Region **Singapore** (UAE-র কাছাকাছি) → Create
3. **Connection string** কপি করুন — দেখতে এরকম:
   ```
   postgresql://neondb_owner:XXXX@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

### ধাপ ৩ — Render-এ ডিপ্লয়
1. **https://render.com** → Sign up (GitHub দিয়ে)
2. **New + → Web Service** → আপনার রিপো কানেক্ট করুন
3. নিচের সেটিংস দিন:

| সেটিং | ভ্যালু |
|---|---|
| **Name** | `virexamart` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Plan** | **Free** ✅ |

4. **Environment Variables** (Advanced → Add):
   ```bash
   NODE_ENV=production
   DATABASE_URL=<নিয়ন থেকে নেওয়া স্ট্রিং>
   APP_URL=https://virexamart.onrender.com
   API_URL=https://virexamart.onrender.com
   SESSION_SECRET=<এলোমেলো লম্বা স্ট্রিং>
   COOKIE_SECURE=true
   COOKIE_SAME_SITE=none
   DEMO_MODE=false
   ADMIN_BASE_PATH=/admin
   ```
   > SESSION_SECRET বানানোর সহজ উপায়: টার্মিনালে `openssl rand -hex 64` চালান।

5. **Create Web Service** → ৩-৫ মিনিটে ডিপ্লয় শেষ
6. আপনার সাইট: **https://virexamart.onrender.com** 🎉

### ধাপ ৪ — সাইট জাগিয়ে রাখুন (ফ্রি টিয়ারের ঘুম ভাঙানো)
Render ফ্রি টিয়ারে ১৫ মিনিট কেউ না ঢুকলে সার্ভার ঘুমিয়ে যায়। ফ্রি সমাধান:
- **UptimeRobot.com** (ফ্রি) → New Monitor → HTTP → `https://virexamart.onrender.com/api/health` → ৫ মিনিট পরপর পিং
- এতে সার্ভার সবসময় জাগানো থাকে (ফ্রি টিয়ারে মাসে ৭৫০ ঘণ্টা — UptimeRobot-এর পিং-এ পুরো চলে)

### ধাপ ৫ — অ্যাডমিন
`https://virexamart.onrender.com/admin` → `admin@desertcart.ae` / `Admin@12345` → **সাথে সাথে পাসওয়ার্ড বদলান!**

### ধাপ ৬ — নিজের ডোমেইন (পরে)
Render → Service → Settings → **Custom Domain** → `virexamart.com` যোগ করুন → ডোমেইন কোম্পানিতে **CNAME** রেকর্ড: `virexamart.com → virexamart.onrender.com` → SSL অটো!

---

## 🧩 বিকল্প: আলাদা আলাদা ফ্রি সার্ভিস (স্প্লিট)

চাইলে ফ্রন্টএন্ড/ব্যাকএন্ড আলাদা রাখতে পারেন (দরকার হলে):

| অংশ | ফ্রি সার্ভিস | সীমা |
|---|---|---|
| **ফ্রন্টএন্ড** (স্ট্যাটিক) | **Cloudflare Pages** / **Vercel** / **Netlify** | ∞ ফ্রি, দ্রুত CDN |
| **ব্যাকএন্ড** (API) | **Render** ফ্রি | ৫১২MB RAM, ১৫মি ঘুম |
| **ডাটাবেস** | **Neon** / **Supabase** | ০.৫GB স্টোরেজ ফ্রি |

**Cloudflare Pages-এ ফ্রন্টএন্ড:**
```toml
# public/_redirects (Netlify/Cloudflare) — /api রিকোয়েস্ট ব্যাকএন্ডে পাঠাবে
/api/*  https://virexamart.onrender.com/api/:splat  200
```

> ⚠️ স্প্লিট করলে ব্যাকএন্ডের `.env`-এ `ALLOWED_ORIGINS`-এ ফ্রন্টএন্ডের URL দিন (যেমন `https://virexamart.pages.dev`)। কোডে সব রেডি আছে — হেডার-টোকেন অথ কাজ করে, কুকি দরকার হয় না।

---

## 🚀 অ্যাডভান্স: Oracle Cloud ফ্রি VPS (সত্যিকারের ফ্রি সার্ভার)

সবচেয়ে শক্তিশালী ফ্রি অপশন — **Oracle Cloud Always Free**:
- **৪-core ARM CPU + ২৪GB RAM + ২০০GB ডিস্ক** — আজীবন ফ্রি!
- একাউন্ট খুলতে ক্রেডিট কার্ড লাগে (চার্জ হয় না, ভেরিফিকেশনের জন্য)
- সেটআপ একটু জটিল — VPS পেলে `docs/DEPLOYMENT.md`-এর nginx গাইড ফলো করুন

---

## ⚠️ ফ্রি টিয়ারের সীমাবদ্ধতা (সৎ কথা)

| সমস্যা | ফ্রি সমাধান | পেইড আপগ্রেড (যখন বিক্রি বাড়বে) |
|---|---|---|
| সার্ভার ঘুমায় (Render) | UptimeRobot পিং | $7/মাস — কখনো ঘুমায় না |
| কোল্ড স্টার্ট ৩০-৬০ সেকেন্ড | প্রথম দর্শক একটু অপেক্ষা | উপরের মতোই |
| ডাটাবেস ০.৫GB (Neon) | হাজার হাজার অর্ডার ধরবে | $19/মাস — ১০GB+ |
| ফ্রি ডোমেইন `onrender.com` | দিয়ে শুরু করুন | ডোমেইন কিনুন (~$10/বছর) |

**সৎ পরামর্শ:** ফ্রি টিয়ারে টেস্ট + প্রথম বিক্রি শুরু করুন। মাসে ৫০-১০০+ অর্ডার হলে তবেই পেইডে যান — ততদিনে ব্যয় শূন্য!

---

## ✅ ফ্রি হোস্টিং চেকলিস্ট

- [ ] GitHub-এ পুশ
- [ ] Neon-এ ডাটাবেস (সিঙ্গাপুর রিজিয়ন)
- [ ] Render ওয়েব সার্ভিস (ফ্রি প্ল্যান)
- [ ] Environment Variables বসানো (DEMO_MODE=false!)
- [ ] UptimeRobot পিং
- [ ] অ্যাডমিন পাসওয়ার্ড বদলানো
- [ ] টেস্ট COD অর্ডার → অ্যাডমিনে দেখা
- [ ] WhatsApp নম্বর Settings-এ
- [ ] সাইট চালু — শেয়ার করুন! 🎉

**প্রশ্ন থাকলে বা কোনো ধাপে আটকালে — স্ক্রিনশটসহ বলুন, স্টেপ-বাই-স্টেপ হেল্প করব! 🚀**
