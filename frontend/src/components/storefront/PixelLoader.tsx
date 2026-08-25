// Analytics pixel loader — injects Google Analytics (GA4), Meta Pixel
// (Facebook) and TikTok Pixel scripts from Admin Settings, then tracks
// page views + conversion events. IDs are configured in Admin → Settings →
// Analytics (no code changes needed).
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSite } from '../../store';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: {
      (...args: unknown[]): void;
      callMethod?: unknown;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (a: unknown[]) => void;
      init?: (id: string) => void;
      track?: (e: string, p?: Record<string, unknown>) => void;
      trackCustom?: (e: string, p?: Record<string, unknown>) => void;
    };
    _fbq?: unknown;
    ttq?: {
      load?: (id: string) => void;
      page?: () => void;
      track?: (e: string, p?: Record<string, unknown>) => void;
      identify?: (p: Record<string, unknown>) => void;
    };
  }
}

function loadScript(src: string, id: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement('script');
  s.id = id;
  s.src = src;
  s.async = true;
  s.referrerPolicy = 'no-referrer-when-downgrade';
  document.head.appendChild(s);
}

/** Google Analytics 4 (gtag.js) */
function initGa(id: string) {
  if (!window.dataLayer) window.dataLayer = [];
  window.gtag = window.gtag || function gtag() {
    // eslint-disable-next-line prefer-rest-params
    (window.dataLayer as unknown[]).push(arguments);
  };
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${id}`, 'pixel-ga');
  window.gtag('js', new Date());
  window.gtag('config', id);
}

/** Meta / Facebook Pixel */
function initMeta(id: string) {
  const w = window as unknown as Record<string, unknown>;
  const fbq = w.fbq as Record<string, unknown> | undefined;
  if (!fbq) {
    // Standard fbq bootstrapping (matches Meta's official snippet)
    const f = function (this: unknown) {
      // eslint-disable-next-line prefer-rest-params
      const args = arguments as unknown as unknown[];
      const self = f as unknown as Record<string, unknown>;
      if (typeof self.callMethod === 'function') {
        (self.callMethod as (...a: unknown[]) => void).apply(self, args);
      } else {
        ((self.queue as unknown[]) || (self.queue = [])).push(args);
      }
    } as unknown as (...args: unknown[]) => void;
    const fn = f as unknown as Record<string, unknown>;
    fn.callMethod = undefined;
    fn.queue = fn.queue || [];
    fn.push = fn.push || ((a: unknown) => ((fn.queue as unknown[]).push(a), f as never));
    fn.loaded = true;
    fn.version = '2.0';
    w.fbq = f;
    w._fbq = f;
    loadScript('https://connect.facebook.net/en_US/fbevents.js', 'pixel-meta');
  }
  (w.fbq as unknown as { init?: (i: string) => void })?.init?.(id);
}

/** TikTok Pixel */
function initTikTok(id: string) {
  loadScript('https://analytics.tiktok.com/i18n/pixel/events.js', 'pixel-tiktok');
  // ttq is created by the loaded script; use a queue pattern until it exists
  const w = window as unknown as { ttq?: Window['ttq'] };
  if (!w.ttq) {
    const queue: { m: 'load' | 'page' | 'track'; a: unknown[] }[] = [];
    const wrap = (m: 'load' | 'page' | 'track') =>
      function (...a: unknown[]) {
        queue.push({ m, a });
      } as never;
    const stub: Window['ttq'] = {
      load: wrap('load'),
      page: wrap('page'),
      track: wrap('track'),
    } as Window['ttq'];
    w.ttq = stub;
    const timer = setInterval(() => {
      const real = (window as unknown as { ttq?: Window['ttq'] }).ttq;
      if (real && real !== stub) {
        clearInterval(timer);
        for (const q of queue) {
          const fn = real[q.m];
          if (typeof fn === 'function') (fn as (...a: unknown[]) => void)(...q.a);
        }
      }
    }, 500);
    setTimeout(() => clearInterval(timer), 15000);
  }
  w.ttq?.load?.(id);
}

/** Fire a conversion event to every configured pixel. */
export function trackPixelEvent(event: string, params?: Record<string, unknown>) {
  const s = useSite.getState().settings;
  if (!s) return;
  if (s['analytics.gaId']) window.gtag?.('event', event, params);
  if (s['analytics.metaPixelId']) window.fbq?.('trackCustom', event, params);
  if (s['analytics.tiktokPixelId']) window.ttq?.track?.(event, params);
}

export function PixelLoader() {
  const { settings } = useSite();
  const location = useLocation();

  const gaId = String(settings?.['analytics.gaId'] || '');
  const metaId = String(settings?.['analytics.metaPixelId'] || '');
  const tiktokId = String(settings?.['analytics.tiktokPixelId'] || '');

  // Inject scripts once when settings are ready
  useEffect(() => {
    if (!settings) return;
    if (gaId) initGa(gaId);
    if (metaId) initMeta(metaId);
    if (tiktokId) initTikTok(tiktokId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  // Page views on route change
  useEffect(() => {
    if (!settings) return;
    const path = location.pathname + location.search;
    if (gaId) window.gtag?.('event', 'page_view', { page_path: path });
    if (metaId) window.fbq?.('track', 'PageView');
    if (tiktokId) window.ttq?.page?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  return null;
}
