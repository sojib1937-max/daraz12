# 🚀 Virexamart — ডোমেইন লাগানো ও Android অ্যাপ বানানোর সম্পূর্ণ গাইড (বাংলা)

এই গাইডে ধাপে ধাপে দেখানো হলো:
1. **ডোমেইন কানেক্ট করা** (কেনার পর ওয়েবসাইটে বসানো)
2. **Android অ্যাপ বানানো** (APK → ফোনে ইনস্টল → Play Store)
3. **লাইভ করার আগে প্রয়োজনীয় কাজ**

---

## পার্ট ১: ডোমেইন কানেক্ট করা

### ধাপ ১.১ — হোস্টিং (সার্ভার) নিন
ওয়েবসাইট চলার জন্য একটা সার্ভার লাগবে। সহজ অপশন:

| হোস্টিং | দাম (আনুমানিক) | কেন ভালো |
|---|---|---|
| **Render** (render.com) | ফ্রি/থাকা থেকে $7/মাস | সবচেয়ে সহজ, এক ক্লিক ডিপ্লয় |
| **Railway** (railway.app) | $5/মাস থেকে | সহজ, অটো-SSL |
| **VPS** (DigitalOcean/Hetzner) | $6–12/মাস | পূর্ণ নিয়ন্ত্রণ, দ্রুত |
| **Hostinger VPS** | ~৳৪০০/মাস | বাংলাদেশ থেকে জনপ্রিয় |

> **ডাটাবেস:** ফ্রি PostgreSQL — [Neon](https://neon.tech) বা [Supabase](https://supabase.com) (একাউন্ট খুললেই DATABASE_URL পাবেন)

### ধাপ ১.২ — ডোমেইন কিনুন
- **Namecheap / GoDaddy / Hostinger** থেকে কিনুন (যেমন: `virexamart.ae`, `virexamart.com`)
- `.ae` ডোমেইন UAE-তে, `TRA`-তে রেজিস্ট্রেশন লাগে — সহজে `.com` দিয়ে শুরু করুন

### ধাপ ১.৩ — DNS (ডোমেইন পয়েন্ট করা)
ডোমেইন কোম্পানির DNS সেটিংসে যান (যেমন Namecheap → Advanced DNS):

| রেকর্ড | টাইপ | ভ্যালু |
|---|---|---|
| `@` (root) | **A** | আপনার সার্ভারের IP (যেমন `123.45.67.89`) |
| `www` | **CNAME** | `@` (বা A রেকর্ডে একই IP) |

- রেকর্ড যোগ করার **১০ মিনিট–২৪ ঘণ্টা** লাগতে পারে
- চেক করুন: `ping আপনারডোমেইন.com` → সার্ভারের IP দেখালে কাজ হয়েছে

### ধাপ ১.৪ — সার্ভারে প্রজেক্ট ডিপ্লয় করুন

**Render/ Railway ব্যবহার করলে** (সহজ পথ):
1. এই প্রজেক্টটা GitHub-এ আপলোড করুন (নিচে দেখুন)
2. Render-এ **New Web Service** → GitHub repo বাছুন
3. Settings:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. Environment Variables (নিচের টেবিল) বসান
5. Deploy চাপুন — Render নিজেই SSL (HTTPS) দিয়ে দেবে!

**VPS ব্যবহার করলে:**
```bash
# VPS-এ SSH করে ঢুকুন
ssh root@আপনার-সার্ভার-আইপি

# Node + PostgreSQL ইনস্টল
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs postgresql nginx

# প্রজেক্ট ক্লোন/আপলোড
cd /var/www && git clone আপনার-রিপো.git virexamart
cd virexamart && npm install && npm run build

# ডাটাবেস
sudo -u postgres createdb virexamart
npx prisma migrate deploy && npm run db:seed

# .env ফাইল বানান (নিচের টেবিল)
nano backend/.env
```

### ধাপ ১.৫ — Environment Variables (সবচেয়ে গুরুত্বপূর্ণ)

`backend/.env` ফাইলে (গিটহাবে কখনো দেবেন না!):

```bash
NODE_ENV=production
DATABASE_URL=postgresql://...নিয়ন/সুপাবেস-থেকে-নেওয়া...
APP_URL=https://www.আপনারডোমেইন.com
API_URL=https://www.আপনারডোমেইন.com
SESSION_SECRET=<openssl rand -hex 64 চালিয়ে যেটা আসে>
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
DEMO_MODE=false          # ← সবচেয়ে জরুরি! ফেক ডেটা বন্ধ
ADMIN_BASE_PATH=/admin
```

### ধাপ ১.৬ — SSL (HTTPS) + nginx (VPS হলে)

```nginx
server {
    listen 80;
    server_name আপনারডোমেইন.com www.আপনারডোমেইন.com;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl http2;
    server_name আপনারডোমেইন.com www.আপনারডোমেইন.com;
    ssl_certificate     /etc/letsencrypt/live/আপনারডোমেইন.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/আপনারডোমেইন.com/privkey.pem;
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;   # ← নোটিফিকেশনের জন্য জরুরি!
    }
}
```

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d আপনারডোমেইন.com -d www.আপনারডোমেইন.com
```

**সম্পন্ন!** এখন `https://www.আপনারডোমেইন.com` খুললে আপনার স্টোর চালু।

### ধাপ ১.৭ — GitHub-এ আপলোড (প্রজেক্ট বাঁচাতে)

```bash
cd /home/user
git init
git add .
git commit -m "Virexamart full platform"
# GitHub-এ নতুন রিপো বানিয়ে:
git remote add origin https://github.com/আপনারনেম/virexamart.git
git push -u origin main
```

> ⚠️ `.gitignore`-এ `.env` আছে — সিক্রেট কখনো আপলোড হবে না।

---

## পার্ট ২: Android অ্যাপ বানানো

### ধাপ ২.১ — কম্পিউটারে প্রয়োজনীয় জিনিস
1. **Node.js 20+** — nodejs.org
2. **JDK 17+** — https://adoptium.net
3. **Android Studio** (বা শুধু SDK) — developer.android.com
   - SDK Platform 34 + Build-Tools 34 ইনস্টল করুন

### ধাপ ২.২ — অ্যাপের নাম/প্যাকেজ সেট করুন

`mobile/capacitor.config.ts` ফাইলে:
```ts
appId: 'com.virexamart.app',      // ← আপনার প্যাকেজ নাম (ইউনিক হতে হবে)
appName: 'Virexamart',
```

> প্যাকেজ নাম পরে বদলানো যায় না — এখনই ঠিক করে নিন, যেমন `com.yourname.virexamart`

### ধাপ ২.৩ — APK বিল্ড

```bash
# ১. ওয়েবসাইট বিল্ড + অ্যান্ড্রয়েডে সিনক
npm run android:sync

# ২. DEBUG APK (সবচেয়ে সহজ — ফোনে ইনস্টল করতে পারবেন)
npm run android:apk:debug
# ➜ mobile/android/app/build/outputs/apk/debug/app-debug.apk

# ৩. RELEASE APK (Play Store-র বাইরে বিতরণ)
npm run android:apk:release

# ৪. GOOGLE PLAY AAB (Play Store-এ দেওয়ার জন্য)
npm run android:aab
```

**ফোনে ইনস্টল:** APK ফাইল ফোনে পাঠান (WhatsApp/Drive) → ফোনে ট্যাপ করুন → "Unknown sources" অনুমতি দিন → ইনস্টল!

> ⚠️ ডিফল্ট APK **সার্ভার-ইউআরএল ছাড়া** বান্ডেল-মোডে চলে — মানে অ্যাপের ভেতরে ওয়েবসাইটই থাকে, আর ডেটা API থেকে আসে। লাইভ ডোমেইন চালু হলে `capacitor.config.ts`-এ `server.url: 'https://www.আপনারডোমেইন.com'` খুলে দিলে অ্যাপ সরাসরি ডোমেইন থেকে লোড হবে (সবসময় ফ্রেশ কনটেন্ট)।

### ধাপ ২.৪ — সাইনিং (Play Store-এর জন্য জরুরি)

```bash
# ১. কীস্টোর বানান (এই ফাইলটা জীবনে হারাবেন না!)
keytool -genkey -v -keystore virexamart-release.keystore -alias virexamart \
        -keyalg RSA -keysize 2048 -validity 10000

# ২. mobile/android/app/build.gradle-এ যোগ করুন
signingConfigs {
    release {
        storeFile file("virexamart-release.keystore")
        storePassword System.getenv("KEYSTORE_PASSWORD")
        keyAlias "virexamart"
        keyPassword System.getenv("KEYSTORE_PASSWORD")
    }
}
buildTypes { release { signingConfig signingConfigs.release } }

# ৩. সাইনড বিল্ড
KEYSTORE_PASSWORD=******** npm run android:apk:release
```

### ধাপ ২.৫ — Play Store-এ প্রকাশ
1. **Google Play Console** (play.google.com/console) — এককালীন $25
2. **Create app** → নাম Virexamart, ক্যাটাগরি Shopping
3. **App signing:** Play App Signing চালু করুন
4. **AAB ফাইল আপলোড** করুন (`app-release.aab`)
5. **Screenshots:** ফোনে ২টা স্ক্রিনশট (হোম + প্রোডাক্ট পেজ)
6. **Privacy policy URL:** `https://আপনারডোমেইন.com/privacy-policy`
7. **Data safety:** "Personal info (নাম, ফোন, ঠিকানা) — অর্ডার ডেলিভারির জন্য" ঘোষণা করুন (COD-র জন্য সত্য)
8. **Testing:** Internal testing ট্র্যাকে প্রকাশ → নিজে ইনস্টল করে টেস্ট
9. **Production** → রিভিউ → লাইভ!

---

## পার্ট ৩: লাইভ করার আগে চেকলিস্ট ✅

- [ ] `DEMO_MODE=false` — ডেমো ডেটা বন্ধ
- [ ] অ্যাডমিন পাসওয়ার্ড বদলানো + ডেমো অ্যাডমিন মুছে দেওয়া
- [ ] Settings-এ আসল নাম/WhatsApp নম্বর/ইমেইল/লোগো
- [ ] 2FA চালু (অ্যাডমিন → Settings → Admin Users)
- [ ] `SESSION_SECRET` বদলানো
- [ ] Google Search Console-এ `sitemap.xml` সাবমিট
- [ ] TikTok/Meta/GA পিক্সেল Settings-এ বসানো
- [ ] টেস্ট COD অর্ডার দিয়ে ফুল ফ্লো চেক
- [ ] ব্যাকআপ চালু (`scripts/backup.sh` cron-এ)

---

## দরকারি কমান্ডস (সংক্ষেপ)

```bash
npm install          # সব ডিপেন্ডেন্সি
npm run dev          # লোকাল ডেভ (ব্যাকএন্ড + ফ্রন্টেন্ড)
npm run build        # প্রোডাকশন বিল্ড
npm start            # সার্ভার চালু
npm test             # ৫২টি টেস্ট
npm run db:migrate   # ডাটাবেস মাইগ্রেশন
npm run db:seed      # ডেমো ডেটা
npm run db:backup    # ব্যাকআপ

# অ্যাপ
npm run android:sync
npm run android:apk:debug
npm run android:apk:release
npm run android:aab
```

**কোনো ধাপে আটকে গেলে বলুন — সাথে সাথে সাহায্য করব! 🚀**
