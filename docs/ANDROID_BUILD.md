# Android Build Guide

The Android app is a **Capacitor 6** project that packages the *same production
frontend* — full navigation, cart, COD checkout, login and order tracking work
identically because it is the same web app in a native shell. It is **not** a
fake WebView wrapper: Capacitor provides native app lifecycle, secure origin
handling, splash screen, back-button integration and offline PWA support.

## Prerequisites

- Node 20+, JDK 17+ (`java -version`)
- Android Studio (or just the SDK): Android SDK Platform 34 + Build-Tools 34
- `ANDROID_HOME` set (e.g. `export ANDROID_HOME=$HOME/Android/Sdk`)

## 1. Configuration (already done, adjust as needed)

`mobile/capacitor.config.ts`:

| Setting | Default | Meaning |
|---|---|---|
| `appId` | `com.desertcart.app` | Your package name — change before release (must be unique on Play) |
| `appName` | `DesertCart` | Launcher label |
| `webDir` | `../frontend/dist` | The built web app bundled inside the APK |

Override without editing code:

```bash
ANDROID_APP_ID=com.yourstore.app ANDROID_APP_NAME="Your Store" npm run android:sync
```

App name, icons and splash are in `mobile/android/app/src/main/res/`.

## 2. Build the APK / AAB

```bash
# Build the web app and copy it into the Android project
npm run android:sync

# Debug APK (unsigned, installable on any device with USB debugging)
npm run android:apk:debug
# → mobile/android/app/build/outputs/apk/debug/app-debug.apk

# Release APK (unsigned until you configure signing, see §3)
npm run android:apk:release

# Google Play AAB
npm run android:aab
# → mobile/android/app/build/outputs/bundle/release/app-release.aab
```

First build downloads Gradle + dependencies (several minutes). Subsequent builds are fast.

## 3. Release signing (required for Play Store)

```bash
# 1. Generate a keystore — KEEP IT SAFE, you cannot replace it on Play
keytool -genkey -v -keystore desertcart-release.keystore -alias desertcart \
        -keyalg RSA -keysize 2048 -validity 10000

# 2. Reference it in mobile/android/app/build.gradle (android → signingConfigs)
signingConfigs {
    release {
        storeFile file("desertcart-release.keystore")
        storePassword System.getenv("KEYSTORE_PASSWORD")
        keyAlias "desertcart"
        keyPassword System.getenv("KEYSTORE_PASSWORD")
    }
}
buildTypes { release { signingConfig signingConfigs.release } }

# 3. Build signed
KEYSTORE_PASSWORD=******** npm run android:apk:release
```

Never commit the keystore or passwords. Keep the keystore + passwords in your
password manager and an offline backup.

## 4. Bundle mode vs Server URL mode

- **Bundled (default)**: the web app ships inside the APK. Data comes from your
  API over HTTPS. Works offline for cached pages (PWA service worker). Updates
  require a new app release — good for review/store consistency.
- **Server URL mode**: uncomment `server.url` in `capacitor.config.ts` to load
  straight from `https://www.yourstore.ae`. Content is always fresh (no app
  updates needed); the app behaves like a Trusted Web Activity. `cleartext: false`
  enforces HTTPS. For install-to-home-screen UX prefer this mode once your domain
  is live.

## 5. Play Store preparation

1. Create a Google Play Console developer account (one-time $25).
2. App signing: upload the **AAB** — Play manages app signing keys (or use Play
   App Signing with your keystore from §3).
3. Content:
   - App name: DesertCart (or your store name)
   - Short description: "Shop in the UAE with Cash on Delivery…"
   - Category: Shopping
   - Icons: already generated in `res/mipmap-*` (update with your brand if needed)
   - Screenshots: 2+ phone screenshots (use your live site)
   - Privacy policy URL: host your `/privacy-policy` page
   - Data safety: declare "Personal info (name, phone, address) collected for
     order fulfilment" — accurate for COD
4. Testing: use Play's internal testing track → opt-in link → install → place a
   test COD order → verify it appears in your admin panel.
5. Release: rollout to production when ready.

## 6. Common issues

| Symptom | Fix |
|---|---|
| `SDK location not found` | `echo "sdk.dir=$ANDROID_HOME" > mobile/android/local.properties` |
| `Unsupported class file major version` | Use JDK 17+ (`export JAVA_HOME=…`) |
| White screen on device | Check `adb logcat`; ensure API base URL is HTTPS (no cleartext) in server-url mode |
| Notifications don't arrive | This build uses in-app real-time notifications (SSE). For push, wire a provider (FCM/OneSignal) — the notification architecture is provider-agnostic |
| WebView caches old build | `npx cap sync android` again; bump `appVersionCode` in `build.gradle` |

## 7. Capacitor plugins included

- `@capacitor/app` — back button, app state
- `@capacitor/network` — connectivity awareness (PWA offline fallback)
- `@capacitor/status-bar` — emerald status bar matching the brand
