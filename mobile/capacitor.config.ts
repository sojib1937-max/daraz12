// ============================================================
// DesertCart — Capacitor configuration
// ------------------------------------------------------------
// The Android app is a native WebView (Capacitor) running the SAME
// production frontend build. All navigation, checkout, COD ordering,
// and tracking work exactly like the website because it IS the website.
//
// Two deployment modes:
//   1. Bundled app: webDir points at the built frontend — the app works
//      offline-first and talks to the API over the network.
//   2. Server URL mode: set server.url to your production site and the
//      app loads straight from your domain (content always fresh).
//      In this mode the app is effectively a Trusted Web Activity.
// ============================================================
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: process.env.ANDROID_APP_ID || 'com.desertcart.app',
  appName: process.env.ANDROID_APP_NAME || 'DesertCart',
  webDir: process.env.CAP_WEB_DIR || '../frontend/dist',
  backgroundColor: '#0f5132',

  // ---- Server URL mode (uncomment to load from your production domain) ----
  // server: {
  //   url: 'https://www.yourdomain.ae',
  //   cleartext: false,
  // },

  android: {
    // Keep the WebView state across rotation and backgrounding
    allowMixedContent: false,
    captureInput: true,
  },

  plugins: {
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0f5132',
    },
    Network: {},
    App: {},
  },

  // Bundle the PWA service worker assets too
  includeAssets: ['**/*'],
};

export default config;
