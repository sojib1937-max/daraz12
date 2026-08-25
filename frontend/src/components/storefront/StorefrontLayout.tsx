// Storefront layout — Daraz-style: top mini bar, big search header,
// orange category strip, cart drawer, social-proof popup, footer.
import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Search, ShoppingCart, Heart, User, Menu, X, Globe, Truck, ShieldCheck,
  Headphones, RotateCcw, MessageCircle, Copy, Check, TrendingUp, Zap, Phone, Mail, Clock,
  Home as HomeIcon, LayoutGrid, ArrowUp,
} from 'lucide-react';
import { useSite, useCart, useAuth, useUi, toast } from '../../store';
import { useI18n, useLang, useT } from '../../i18n';
import { api } from '../../lib/api';
import { aed, waLink } from '../../lib/format';
import { Toasts } from '../ui';
import { useLocalFlag } from '../../hooks';
import { OrganizationJsonLd } from './Seo';
import { PixelLoader } from './PixelLoader';

export function StorefrontLayout() {
  const { settings } = useSite();
  const maintenance = settings && settings['maintenance.enabled'];
  if (maintenance) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream p-6">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">🛠️</div>
          <h1 className="text-xl font-bold mb-2">{settings?.['maintenance.message'] || 'We are performing scheduled maintenance.'}</h1>
          <p className="text-sm text-ink/50">Please check back soon.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <OrganizationJsonLd />
      <PixelLoader />
      <AnnouncementBar />
      <TopMiniBar />
      <Header />
      <CategoryStrip />
      <FeaturesStrip />
      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <MobileNav />
      <MobileBottomNav />
      <BackToTop />
      <SalesPopup />
      <DiscountPopup />
      <WhatsAppFloat />
      <Toasts />
    </div>
  );
}

// ---------------- Announcement bar (premium orange gradient) ----------------
function AnnouncementBar() {
  const { settings } = useSite();
  const { lang } = useI18n();
  const t = useT();
  if (!settings || settings['announcement.enabled'] === false) return null;
  const text = lang === 'ar' && settings['announcement.textAr'] ? settings['announcement.textAr'] : settings['announcement.text'];
  return (
    <div className="bg-gradient-to-r from-brand-600 via-brand-500 to-brand-600 text-white text-center text-[12px] md:text-[13px] font-semibold py-2 px-4">
      {text}
      {settings['announcement.link'] && (
        <Link to={settings['announcement.link']} className="underline underline-offset-2 ms-2 opacity-90">
          {t('home.viewAllProducts')}
        </Link>
      )}
    </div>
  );
}

// ---------------- Top mini bar (light — authentic Daraz) ----------------
function TopMiniBar() {
  const { settings } = useSite();
  const { lang, setLang } = useI18n();
  const t = useT();
  return (
    <div className="hidden md:block bg-white border-b border-ink/5 text-ink/60 text-[12px]">
      <div className="max-w-7xl mx-auto px-4 h-9 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/track-order" className="hover:text-brand-500 transition-colors">{t('nav.track')}</Link>
          <Link to="/contact" className="hover:text-brand-500 transition-colors">{t('nav.contact')}</Link>
          <Link to="/faq" className="hover:text-brand-500 transition-colors">{t('nav.faq')}</Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><Truck size={13} className="text-brand-500" /> {t('home.trustFast')}</span>
          <span className="flex items-center gap-1.5"><BanknoteIcon /> {t('common.cashOnDelivery')}</span>
          <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="flex items-center gap-1 hover:text-brand-500 transition-colors">
            <Globe size={13} /> {lang === 'en' ? 'العربية' : 'English'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BanknoteIcon() {
  return <span className="inline-block h-3 w-3 rounded-full bg-gold-400" />;
}

// ---------------- Main header (authentic Daraz: WHITE + orange accents) ----------------
function Header() {
  const { settings } = useSite();
  const { lang, setLang } = useI18n();
  const t = useT();
  const cart = useCart();
  const { customer } = useAuth();
  const { setCartDrawerOpen, setMobileNavOpen } = useUi();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const storeName = settings?.['store.name'] || 'Virexamart';
  const logo = settings?.['store.logo'] ? String(settings['store.logo']) : '';

  return (
    <header className={`sticky top-0 z-50 bg-white text-ink transition-shadow ${scrolled ? 'shadow-card' : ''}`}>
      <div className="max-w-7xl mx-auto px-3 md:px-4">
        {/* Row 1 */}
        <div className="flex items-center gap-2 md:gap-4 h-14 md:h-[72px]">
          {/* Mobile menu */}
          <button className="lg:hidden p-2 -ms-1 text-ink/70" onClick={() => setMobileNavOpen(true)} aria-label="Menu">
            <Menu size={22} />
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label={storeName}>
            {logo ? (
              <img src={logo} alt={storeName} className="h-9 w-9 md:h-10 md:w-10 rounded-lg object-cover" />
            ) : (
              <span className="h-9 w-9 md:h-10 md:w-10 rounded-lg bg-brand-500 text-white font-extrabold flex items-center justify-center text-lg">V</span>
            )}
            <span className="font-extrabold text-xl md:text-2xl tracking-tight text-brand-500 hidden sm:block">{storeName}</span>
          </Link>

          {/* Big search (desktop) — Daraz: cream input + orange button */}
          <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-2xl mx-auto items-stretch h-11">
            <div className="relative flex-1">
              <Search size={17} className="absolute start-4 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('nav.searchPlaceholder')}
                className="w-full h-full ps-11 pe-4 rounded-s-lg bg-cream border border-ink/10 focus:border-brand-400 focus:outline-none text-sm"
                aria-label="Search"
              />
            </div>
            <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-e-lg px-7 transition-colors" aria-label={t('common.search')}>
              <Search size={18} />
            </button>
          </form>

          {/* Right icons */}
          <div className="flex items-center gap-0.5 md:gap-1 ms-auto md:ms-0">
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="hidden sm:flex items-center gap-1 p-2 rounded-lg text-sm font-bold text-ink/60 hover:bg-cream"
              aria-label="Switch language"
            >
              <Globe size={17} />
              <span className="hidden lg:inline">{lang === 'en' ? 'العربية' : 'English'}</span>
            </button>

            {/* Desktop labeled icons (Daraz: dark icons, orange hover) */}
            <div className="hidden md:flex items-center">
              <Link to="/wishlist" className="flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg hover:bg-cream group" aria-label={t('nav.wishlist')}>
                <Heart size={21} className="text-ink/70 group-hover:text-brand-500 transition-colors" />
                <span className="text-[10px] font-semibold text-ink/50">{t('nav.wishlist')}</span>
              </Link>
              <Link to={customer ? '/account' : '/login'} className="flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg hover:bg-cream group" aria-label={t('nav.account')}>
                <User size={21} className="text-ink/70 group-hover:text-brand-500 transition-colors" />
                <span className="text-[10px] font-semibold text-ink/50">{customer ? t('nav.account') : t('nav.login')}</span>
              </Link>
              <button
                onClick={() => setCartDrawerOpen(true)}
                className="relative flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg hover:bg-cream group"
                aria-label={`${t('cart.title')} (${cart.count()})`}
              >
                <ShoppingCart size={21} className="text-ink/70 group-hover:text-brand-500 transition-colors" />
                <span className="text-[10px] font-semibold text-ink/50">{t('nav.shop') === 'Shop' ? 'Cart' : 'السلة'}</span>
                {cart.count() > 0 && (
                  <span className="absolute top-0 end-0.5 bg-brand-500 text-white text-[10px] font-extrabold rounded-full h-[18px] min-w-[18px] flex items-center justify-center px-1">
                    {cart.count() > 99 ? '99+' : cart.count()}
                  </span>
                )}
              </button>
            </div>

            {/* Mobile cart icon */}
            <button
              onClick={() => setCartDrawerOpen(true)}
              className="relative md:hidden p-2 rounded-lg text-ink/70"
              aria-label={`${t('cart.title')} (${cart.count()})`}
            >
              <ShoppingCart size={22} />
              {cart.count() > 0 && (
                <span className="absolute -top-0.5 -end-0.5 bg-brand-500 text-white text-[10px] font-extrabold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                  {cart.count() > 99 ? '99+' : cart.count()}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile search row */}
        <form onSubmit={submitSearch} className="md:hidden pb-2.5 flex items-stretch gap-1.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('nav.searchPlaceholder')}
              className="w-full h-9 ps-9 pe-3 rounded-lg bg-cream border border-ink/10 focus:border-brand-400 focus:outline-none text-[13px]"
              aria-label="Search"
            />
          </div>
          <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg px-4 transition-colors" aria-label={t('common.search')}>
            <Search size={16} />
          </button>
        </form>
      </div>
    </header>
  );
}

// ---------------- Category strip (authentic Daraz: WHITE with orange "All Categories") ----------------
function CategoryStrip() {
  const t = useT();
  const [categories, setCategories] = useState<{ slug: string; name: string; imageUrl: string | null }[]>([]);

  useEffect(() => {
    api.get<{ slug: string; name: string; imageUrl: string | null }[]>('/api/categories').then(setCategories).catch(() => undefined);
  }, []);

  return (
    <nav className="hidden lg:block bg-white border-b border-ink/5 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 overflow-x-auto no-scrollbar">
        <Link to="/shop" className="flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-bold whitespace-nowrap text-brand-500 hover:bg-brand-50 rounded-md transition-colors">
          <Menu size={15} /> {t('nav.allCategories')}
        </Link>
        {categories.slice(0, 12).map((c) => (
          <Link key={c.slug} to={`/category/${c.slug}`} className="px-3 py-2.5 text-[13px] font-medium whitespace-nowrap text-ink/70 hover:text-brand-500 hover:bg-cream rounded-md transition-colors">
            {c.name}
          </Link>
        ))}
        <Link to="/shop" className="ms-auto px-3 py-2.5 text-[13px] font-bold whitespace-nowrap text-brand-500 hover:bg-brand-50 rounded-md transition-colors">
          {t('nav.shopAll')}
        </Link>
      </div>
    </nav>
  );
}

// ---------------- Trust features strip (Daraz-style, under header) ----------------
function FeaturesStrip() {
  const t = useT();
  const features = [
    { icon: <BanknoteIcon />, label: t('home.trustCod'), sub: t('home.trustCodSub') },
    { icon: <Truck size={18} />, label: t('home.trustFast'), sub: t('home.trustFastSub') },
    { icon: <RotateCcw size={18} />, label: t('home.trustReturns'), sub: t('home.trustReturnsSub') },
    { icon: <ShieldCheck size={18} />, label: t('common.secureCheckout'), sub: t('checkout.trust2') },
  ];
  return (
    <div className="hidden md:block bg-white border-b border-ink/5">
      <div className="max-w-7xl mx-auto px-4 h-14 grid grid-cols-4 items-center">
        {features.map((f) => (
          <div key={f.label} className="flex items-center justify-center gap-2.5 px-2">
            <span className="h-9 w-9 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">{f.icon}</span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-ink leading-none">{f.label}</p>
              <p className="text-[10px] text-ink/45 mt-0.5 truncate">{f.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Mobile bottom navigation (Daraz app-style) ----------------
function MobileBottomNav() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const cart = useCart();
  const { customer } = useAuth();
  const { setCartDrawerOpen } = useUi();

  // Hide on checkout / order success (full focus)
  const hidden = location.pathname.startsWith('/checkout') || location.pathname.startsWith('/order-success');

  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));

  const tabs = [
    {
      key: 'home',
      icon: <HomeIcon size={20} />,
      label: t('nav.home'),
      active: isActive('/') && !isActive('/shop') && !isActive('/category'),
      onClick: () => navigate('/'),
    },
    {
      key: 'shop',
      icon: <LayoutGrid size={20} />,
      label: t('nav.categories'),
      active: isActive('/shop') || isActive('/category') || isActive('/search'),
      onClick: () => navigate('/shop'),
    },
    {
      key: 'cart',
      icon: (
        <span className="relative">
          <ShoppingCart size={20} />
          {cart.count() > 0 && (
            <span className="absolute -top-1.5 -end-1.5 bg-brand-500 text-white text-[9px] font-extrabold rounded-full h-4 min-w-4 flex items-center justify-center px-0.5">
              {cart.count() > 9 ? '9+' : cart.count()}
            </span>
          )}
        </span>
      ),
      label: t('cart.title'),
      active: isActive('/cart'),
      onClick: () => setCartDrawerOpen(true),
    },
    {
      key: 'account',
      icon: <User size={20} />,
      label: customer ? t('nav.account') : t('nav.login'),
      active: isActive('/account') || isActive('/login'),
      onClick: () => navigate(customer ? '/account' : '/login'),
    },
  ];

  if (hidden) return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-[70] md:hidden bg-white/95 backdrop-blur border-t border-ink/8 pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={tab.onClick}
            className={`flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
              tab.active ? 'text-brand-500' : 'text-ink/55 hover:text-brand-500'
            }`}
            aria-current={tab.active ? 'page' : undefined}
          >
            {tab.icon}
            <span className="text-[10px] font-bold leading-none">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// ---------------- Mobile nav drawer ----------------
function MobileNav() {
  const { mobileNavOpen, setMobileNavOpen } = useUi();
  const t = useT();
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);
  const { customer } = useAuth();

  useEffect(() => {
    if (mobileNavOpen) {
      api.get<{ slug: string; name: string }[]>('/api/categories').then((c) => setCategories(c)).catch(() => undefined);
    }
  }, [mobileNavOpen]);

  const links = [
    { to: '/', label: t('nav.home') },
    { to: '/shop', label: t('nav.shop') },
    { to: '/track-order', label: t('nav.track') },
    { to: '/wishlist', label: t('nav.wishlist') },
    { to: customer ? '/account' : '/login', label: customer ? t('nav.account') : t('nav.login') },
    { to: '/about', label: t('nav.about') },
    { to: '/contact', label: t('nav.contact') },
    { to: '/faq', label: t('nav.faq') },
  ];

  return (
    <div className={`fixed inset-0 z-[80] lg:hidden ${mobileNavOpen ? '' : 'pointer-events-none'}`} aria-hidden={!mobileNavOpen}>
      <div className={`absolute inset-0 bg-ink/50 transition-opacity ${mobileNavOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setMobileNavOpen(false)} />
      <div className={`absolute inset-y-0 start-0 w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col transition-transform duration-300 ${mobileNavOpen ? 'translate-x-0 rtl:translate-x-0' : '-translate-x-full rtl:translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-ink/8">
          <span className="font-extrabold text-brand-500 text-lg">Virexamart</span>
          <button onClick={() => setMobileNavOpen(false)} className="p-2 rounded-lg hover:bg-cream" aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 grid gap-0.5" aria-label="Mobile navigation">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMobileNavOpen(false)}
              className="px-4 py-3 rounded-xl text-[15px] font-semibold text-ink/75 hover:bg-brand-50 hover:text-brand-600"
            >
              {l.label}
            </Link>
          ))}
          <p className="px-4 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink/35">{t('nav.categories')}</p>
          {categories.map((c) => (
            <Link
              key={c.slug}
              to={`/category/${c.slug}`}
              onClick={() => setMobileNavOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm text-ink/60 hover:bg-brand-50 hover:text-brand-600"
            >
              {c.name}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

// ---------------- Cart drawer ----------------
function CartDrawer() {
  const { cartDrawerOpen, setCartDrawerOpen } = useUi();
  const cart = useCart();
  const t = useT();
  const { settings } = useSite();
  const navigate = useNavigate();
  const subtotal = cart.subtotal();
  const freeShipThreshold = Number(settings?.['shipping.freeShippingThreshold'] || 0);
  const remaining = Math.max(0, freeShipThreshold - subtotal);

  if (!cartDrawerOpen) return null;
  return (
    <div className="fixed inset-0 z-[85]" role="dialog" aria-label={t('cart.title')}>
      <div className="absolute inset-0 bg-ink/50 animate-fade-in" onClick={() => setCartDrawerOpen(false)} />
      <div className="absolute inset-y-0 end-0 w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between p-4 border-b border-ink/8 bg-brand-500 text-white">
          <h2 className="font-bold text-lg">{t('cart.title')} ({cart.count()})</h2>
          <button onClick={() => setCartDrawerOpen(false)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Close cart">
            <X size={20} />
          </button>
        </div>

        {freeShipThreshold > 0 && subtotal > 0 && (
          <div className="px-4 py-3 bg-brand-50 border-b border-brand-100 text-[13px] font-medium text-brand-700">
            {remaining > 0 ? (
              <span>{t('cart.freeShippingProgress', { n: aed(Math.ceil(remaining), { compact: true }).replace('AED ', '') })}</span>
            ) : (
              <span>{t('cart.freeShippingReached')}</span>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 grid gap-3 content-start">
          {cart.items.length === 0 && (
            <div className="text-center py-14 text-ink/40">
              <ShoppingCart className="mx-auto h-12 w-12 mb-3 opacity-40" />
              <p className="font-medium">{t('cart.empty')}</p>
            </div>
          )}
          {cart.items.map((item) => (
            <div key={`${item.productId}-${item.variantId ?? ''}`} className="flex gap-3 bg-white rounded-xl border border-ink/8 p-3">
              <Link to={`/product/${item.slug || ''}`} onClick={() => setCartDrawerOpen(false)}>
                <img src={item.image || ''} alt={item.title} className="h-16 w-16 rounded-lg object-cover bg-cream" loading="lazy" />
              </Link>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold line-clamp-2">{item.title}</p>
                {item.variantName && <p className="text-xs text-ink/45 mt-0.5">{item.variantName}</p>}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-sm font-bold text-brand-600">{aed(item.price)}</span>
                  <span className="text-xs text-ink/45">× {item.quantity}</span>
                </div>
              </div>
              <button onClick={() => cart.remove(item.productId, item.variantId)} className="self-start p-1 text-ink/35 hover:text-red-500" aria-label={t('common.remove')}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        {cart.items.length > 0 && (
          <div className="border-t border-ink/8 p-4 grid gap-3">
            <div className="flex justify-between text-sm font-semibold">
              <span>{t('cart.subtotal')}</span>
              <span className="font-extrabold">{aed(subtotal)}</span>
            </div>
            <button
              className="btn-primary w-full !py-3.5 text-[15px]"
              onClick={() => {
                setCartDrawerOpen(false);
                navigate('/checkout');
              }}
            >
              {t('cart.checkout')}
            </button>
            <Link to="/cart" onClick={() => setCartDrawerOpen(false)} className="text-center text-sm font-semibold text-brand-600 hover:underline">
              {t('cart.title')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Social proof popup (real orders, masked) ----------------
interface SaleEvent {
  id: number;
  orderNumber?: string;
  productTitle: string;
  productImage: string | null;
  productSlug?: string;
  emirate: string;
  customerInitial: string | null;
  timeAgoEn: string;
  timeAgoAr: string;
  demo?: boolean;
}

function SalesPopup() {
  const { settings } = useSite();
  const { lang } = useI18n();
  const t = useT();
  const [sale, setSale] = useState<SaleEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const shownToday = useRef(0);
  const timerRef = useRef<number | null>(null);
  const shownIds = useRef<Set<number>>(new Set());

  const showSale = (data: SaleEvent) => {
    const maxPerDay = Number(settings?.['popups.salesMaxPerDay'] || 25);
    const duration = Number(settings?.['popups.salesDurationMs'] || 8000);
    if (shownIds.current.has(data.id)) return;
    shownIds.current.add(data.id);
    shownToday.current += 1;
    if (shownToday.current > maxPerDay) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setSale(data);
    setVisible(true);
    timerRef.current = window.setTimeout(() => setVisible(false), duration);
  };

  useEffect(() => {
    if (!settings || settings['popups.salesEnabled'] === false) return;
    const interval = Math.max(30, Number(settings['popups.salesIntervalSec'] || 45)) * 1000;

    let es: EventSource | null = null;
    let pollTimer: number | null = null;
    let switchedToPolling = false;
    let sseFailed = false;

    // SSE path — instant real-time (works when same-origin or proxy allows streaming)
    const startSse = () => {
      es = new EventSource('/api/events/sales');
      es.addEventListener('recent-sale', (e) => {
        try {
          showSale(JSON.parse((e as MessageEvent).data as string) as SaleEvent);
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => {
        // SSE broken (buffered proxy / cross-origin) → fall back to polling
        if (!sseFailed) {
          sseFailed = true;
          es?.close();
          startPolling();
        }
      };
      // If no hello within 5s, assume blocked → poll
      setTimeout(() => {
        if (!sseFailed && !switchedToPolling) {
          switchedToPolling = true;
          es?.close();
          startPolling();
        }
      }, 5000);
    };

    // Polling fallback — works anywhere (plain fetch with CORS)
    const startPolling = () => {
      if (pollTimer) return;
      const poll = async () => {
        try {
          const items = await api.get<SaleEvent[]>('/api/events/sales/recent');
          for (const item of items) showSale(item);
        } catch {
          /* offline / not ready */
        }
      };
      poll();
      pollTimer = window.setInterval(poll, interval);
    };

    startSse();
    return () => {
      es?.close();
      if (pollTimer) window.clearInterval(pollTimer);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  if (!sale || !visible) return null;
  const name = sale.customerInitial ? `${sale.customerInitial} — ` : '';

  return (
    <div
      className="fixed bottom-20 md:bottom-6 start-4 z-[70] w-[320px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-lift border border-ink/8 p-3.5 flex gap-3 items-center animate-slide-up cursor-pointer"
      onClick={() => sale.productSlug && (window.location.href = `/product/${sale.productSlug}`)}
      role="status"
    >
      {sale.productImage ? (
        <img src={sale.productImage} alt="" className="h-14 w-14 rounded-xl object-cover bg-cream shrink-0" />
      ) : (
        <div className="h-14 w-14 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <Zap className="text-brand-500" size={22} />
        </div>
      )}
      <div className="min-w-0">
        {sale.demo && (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-600 bg-brand-50 rounded-full px-2 py-0.5 mb-1">
            <TrendingUp size={10} /> {t('popup.demo')}
          </span>
        )}
        <p className="text-[11px] text-ink/50 font-medium">
          {t('popup.recentPurchase')} {name}
          <span className="text-ink/70 font-bold">{sale.productTitle.slice(0, 42)}{sale.productTitle.length > 42 ? '…' : ''}</span>
        </p>
        <p className="text-[11px] text-ink/40 mt-0.5">
          {t('popup.from')} {sale.emirate}, UAE • {lang === 'ar' ? sale.timeAgoAr : sale.timeAgoEn}
        </p>
      </div>
      <button className="ms-auto self-start p-1 text-ink/30 hover:text-ink/60" onClick={(e) => { e.stopPropagation(); setVisible(false); }} aria-label={t('popup.close')}>
        <X size={14} />
      </button>
    </div>
  );
}

// ---------------- Discount popup ----------------
function DiscountPopup() {
  const { settings } = useSite();
  const { lang } = useI18n();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { allowed, markShown } = useLocalFlag('dc_popup_discount', Number(settings?.['popups.discountFrequencyDays'] || 2));
  const location = useLocation();
  const triggered = useRef(false);

  useEffect(() => {
    if (!settings || settings['popups.discountEnabled'] === false) return;
    if (triggered.current || !allowed) return;
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/checkout')) return;
    const delay = Number(settings['popups.discountDelaySec'] || 12) * 1000;
    const timer = window.setTimeout(() => {
      if (!localStorage.getItem('dc_coupon_used')) {
        setOpen(true);
        markShown();
        triggered.current = true;
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [settings, allowed, location.pathname, markShown]);

  if (!open) return null;
  const code = String(settings?.['popups.discountCode'] || 'WELCOME10');
  const title = lang === 'ar' && settings?.['popups.discountTitleAr'] ? String(settings['popups.discountTitleAr']) : String(settings?.['popups.discountTitle'] || t('popup.discountTitle'));

  return (
    <div className="fixed inset-0 z-[88] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/55 backdrop-blur-[2px] animate-fade-in" onClick={() => setOpen(false)} />
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-7 text-center animate-pop-in overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-brand-400 via-brand-500 to-brand-400" />
        <button onClick={() => setOpen(false)} className="absolute top-3 end-3 p-1.5 text-ink/40 hover:text-ink/70" aria-label={t('popup.close')}>
          <X size={18} />
        </button>
        <div className="text-5xl mb-3">🎁</div>
        <h3 className="text-xl font-extrabold text-ink">{title}</h3>
        <p className="text-sm text-ink/55 mt-1">{t('popup.discountSub', { code })}</p>
        <button
          className="mt-4 w-full bg-brand-500 text-white font-extrabold text-lg py-3.5 rounded-2xl tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-brand-600"
          onClick={() => {
            navigator.clipboard?.writeText(code).catch(() => undefined);
            setCopied(true);
            localStorage.setItem('dc_coupon_used', '1');
            setTimeout(() => setOpen(false), 900);
          }}
        >
          {copied ? <Check size={20} /> : <Copy size={18} />}
          {code}
        </button>
        <p className="text-[11px] text-ink/40 mt-3">{copied ? t('popup.copied') : t('cart.couponApplied')}</p>
      </div>
    </div>
  );
}

// ---------------- WhatsApp float ----------------
function WhatsAppFloat() {
  const { settings } = useSite();
  const t = useT();
  const wa = String(settings?.['store.whatsapp'] || '');
  if (!wa) return null;
  return (
    <a
      href={waLink(wa, 'Hello Virexamart! I have a question about an order.')}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-24 md:bottom-5 end-5 z-[60] bg-[#25D366] text-white rounded-full p-3.5 shadow-lift hover:scale-105 transition-transform"
      aria-label={t('misc.whatsapp')}
    >
      <MessageCircle size={26} />
    </a>
  );
}

// ---------------- Footer (premium ORANGE — Daraz-style brand footer) ----------------
function Footer() {
  const { settings } = useSite();
  const { lang } = useI18n();
  const t = useT();
  const year = new Date().getFullYear();
  const about = lang === 'ar' && settings?.['footer.aboutTextAr'] ? String(settings['footer.aboutTextAr']) : String(settings?.['footer.aboutText'] || '');
  const storeName = String(settings?.['store.name'] || 'Virexamart');
  const logo = settings?.['store.logo'] ? String(settings['store.logo']) : '';

  const shopLinks = [
    { to: '/shop', label: t('nav.shopAll') },
    { to: '/about', label: t('footer.about') },
    { to: '/track-order', label: t('footer.track') },
    { to: '/faq', label: t('footer.faq') },
    { to: '/contact', label: t('footer.contact') },
  ];
  const serviceLinks = [
    { to: '/shipping-policy', label: t('footer.shipping') },
    { to: '/return-policy', label: t('footer.returns') },
    { to: '/privacy-policy', label: t('footer.privacy') },
    { to: '/terms', label: t('footer.terms') },
  ];

  return (
    <footer className="bg-gradient-to-b from-brand-500 via-brand-600 to-brand-700 text-white mt-auto">
      {/* Trust strip (premium, above main footer) */}
      <div className="border-b border-white/15 bg-white/5">
        <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <BanknoteIcon />, label: t('home.trustCod'), sub: t('home.trustCodSub') },
            { icon: <Truck size={16} />, label: t('home.trustFast'), sub: t('home.trustFastSub') },
            { icon: <RotateCcw size={16} />, label: t('home.trustReturns'), sub: t('home.trustReturnsSub') },
            { icon: <Headphones size={16} />, label: t('home.trustSupport'), sub: t('home.trustSupportSub') },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-full bg-white/15 text-white flex items-center justify-center shrink-0">{f.icon}</span>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-white leading-none">{f.label}</p>
                <p className="text-[10px] text-white/60 mt-0.5 truncate">{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-3">
        <div className="col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5 mb-3">
            {logo ? (
              <img src={logo} alt={storeName} className="h-10 w-10 rounded-xl object-cover bg-white/90 p-0.5" />
            ) : (
              <span className="h-10 w-10 rounded-xl bg-white text-brand-600 font-extrabold flex items-center justify-center">V</span>
            )}
            <span className="font-extrabold text-lg text-white">{storeName}</span>
          </div>
          <p className="text-sm leading-relaxed text-white/75 max-w-sm">{about}</p>
          <div className="flex gap-2 mt-4">
            {settings?.['social.instagram'] && (
              <a href={String(settings['social.instagram'])} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-lg bg-white/15 flex items-center justify-center hover:bg-white hover:text-brand-600 transition-all hover:-translate-y-0.5" aria-label="Instagram">IG</a>
            )}
            {settings?.['social.tiktok'] && (
              <a href={String(settings['social.tiktok'])} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-lg bg-white/15 flex items-center justify-center text-xs font-bold hover:bg-white hover:text-brand-600 transition-all hover:-translate-y-0.5" aria-label="TikTok">TK</a>
            )}
            {settings?.['social.facebook'] && (
              <a href={String(settings['social.facebook'])} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-lg bg-white/15 flex items-center justify-center text-xs font-bold hover:bg-white hover:text-brand-600 transition-all hover:-translate-y-0.5" aria-label="Facebook">FB</a>
            )}
          </div>
          <ul className="mt-5 grid gap-2 text-[13px] text-white/80">
            <li className="flex items-center gap-2">
              <Phone size={13} className="text-white shrink-0" />
              <span dir="ltr">{String(settings?.['store.phone'] || '—')}</span>
            </li>
            <li className="flex items-center gap-2">
              <Mail size={13} className="text-white shrink-0" />
              <span>{String(settings?.['store.email'] || '—')}</span>
            </li>
            <li className="flex items-center gap-2">
              <Clock size={13} className="text-white shrink-0" />
              <span>{String(settings?.['store.workingHours'] || '—')}</span>
            </li>
          </ul>
          {/* Contact CTA */}
          <a
            href={waLink(String(settings?.['store.whatsapp'] || '971500000000'), 'Hello Virexamart!')}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 bg-white text-brand-600 hover:bg-brand-50 text-[13px] font-bold rounded-lg px-4 py-2.5 transition-colors shadow-sm"
          >
            <MessageCircle size={15} /> {t('success.whatsapp')}
          </a>
        </div>

        <div>
          <h4 className="font-bold text-white mb-4">{t('nav.shop')}</h4>
          <ul className="grid gap-2.5 text-sm">
            {shopLinks.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-white/80 hover:text-white hover:underline transition-colors">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white mb-4">{t('footer.customerService')}</h4>
          <ul className="grid gap-2.5 text-sm">
            {serviceLinks.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-white/80 hover:text-white hover:underline transition-colors">{l.label}</Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 p-3 rounded-xl bg-white/10 text-xs text-white/85 flex items-center gap-2">
            <Truck size={16} className="shrink-0 text-white" />
            <span>{t('footer.paymentsSub')}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="chip bg-white text-brand-600">{t('footer.cod')}</span>
            <span className="chip bg-white/15 text-white">No prepayment</span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/15 bg-black/10">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/70">
          <p>© {year} {storeName}. {t('footer.rights')}</p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck size={14} /> <RotateCcw size={14} /> <Headphones size={14} />
          </p>
        </div>
      </div>
    </footer>
  );
}

// ---------------- Back to top (advanced touch) ----------------
function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-28 md:bottom-6 start-5 z-[60] h-10 w-10 rounded-full bg-brand-500 text-white shadow-lift hover:bg-brand-600 transition-colors flex items-center justify-center"
      aria-label="Back to top"
    >
      <ArrowUp size={18} />
    </button>
  );
}
