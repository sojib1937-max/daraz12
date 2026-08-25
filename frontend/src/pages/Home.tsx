// Daraz-style home page: auto-rotating hero carousel, flash sale with
// countdown, category row, product rows and a "Just For You" grid.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Zap, Banknote } from 'lucide-react';
import { api } from '../lib/api';
import { useSite, useCart, toast } from '../store';
import { useT, useLang, useI18n } from '../i18n';
import { useCountdown, useDocumentTitle } from '../hooks';
import { ProductCard, ProductCardSkeleton } from '../components/storefront/ProductCard';
import { SlideCarousel } from '../components/storefront/Carousel';
import type { HomepageSectionDto, Product, PublicSettings } from '../lib/types';
import { Stars } from '../components/ui';

interface HomeData {
  settings: PublicSettings;
  sections: HomepageSectionDto[];
  featured: Product[];
  bestSellers: Product[];
  recommended: Product[];
  categories: { id: number; name: string; slug: string; imageUrl: string | null; productCount: number }[];
  flashSale: {
    id: number;
    title: string;
    bannerUrl: string | null;
    startsAt: string;
    endsAt: string;
    items: Product[];
  } | null;
  reviews: { id: number; rating: number; title: string | null; content: string; displayName: string; product: { slug: string; title: string; image: string } | null; isDemo: boolean; createdAt: string }[];
}

export function Home() {
  const { lang } = useI18n();
  const t = useT();
  const { setHome, home } = useSite();
  const [data, setData] = useState<HomeData | null>(home as HomeData | null);
  const [error, setError] = useState<string | null>(null);
  const [justForYou, setJustForYou] = useState<Product[] | null>(null);

  useDocumentTitle('Virexamart — UAE Online Shopping with Cash on Delivery');

  useEffect(() => {
    api
      .get<HomeData>('/api/home')
      .then((d) => {
        setData(d);
        setHome(d as never);
      })
      .catch((e) => setError((e as Error).message));
    api
      .get<{ items: Product[] }>('/api/products?limit=16&sort=popular')
      .then((d) => setJustForYou(d.items))
      .catch(() => undefined);
  }, [setHome]);

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <h1 className="font-bold text-lg mb-2">{t('shop.noResults')}</h1>
        <p className="text-sm text-ink/50">{error}</p>
      </div>
    );
  }
  if (!data) return <HomeSkeleton />;

  const sections = data.sections.filter((s) => s.isEnabled !== false).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="pb-10">
      {/* Hero carousel — Daraz style */}
      <HeroCarousel section={sections.find((s) => s.type === 'HERO')} />

      {/* Flash sale */}
      {data.flashSale && <FlashSaleSection data={data} />}

      {/* Categories — rounded row */}
      <CategoriesSection data={data} />

      {/* Product rows */}
      {data.featured.length > 0 && <ProductRow title={t('home.featured')} products={data.featured} link="/shop?sort=newest" />}
      {data.bestSellers.length > 0 && <ProductRow title={t('home.bestSellers')} products={data.bestSellers} link="/shop?sort=popular" />}
      {data.recommended.length > 0 && <ProductRow title={t('home.recommended')} products={data.recommended} link="/shop" />}

      {/* Just For You — Daraz signature grid */}
      <JustForYouGrid products={justForYou} />

      {/* Reviews */}
      {data.reviews.length > 0 && <ReviewsSection reviews={data.reviews} />}

      {/* FAQ */}
      {sections.find((s) => s.type === 'FAQ') && <FaqSection section={sections.find((s) => s.type === 'FAQ')!} />}

      {/* Newsletter */}
      <NewsletterSection />
    </div>
  );
}

// ---------------- Hero carousel (auto-rotating) ----------------
function HeroCarousel({ section }: { section?: HomepageSectionDto }) {
  const t = useT();
  const { lang } = useI18n();
  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  const cfg = (section?.config || {}) as Record<string, unknown>;
  const heroImage = String(cfg.image || '/images/hero.jpg');

  const slides = [
    { image: heroImage, title: lang === 'ar' ? 'منتجات فاخرة. توصيل سريع.' : 'Premium. Delivered Fast.', sub: '', cta: t('home.heroCta'), link: '/shop', badge: '' },
    { image: '/images/cod-banner.jpg', title: lang === 'ar' ? 'الدفع عند الاستلام' : 'Cash on Delivery', sub: '', cta: t('home.heroCta'), link: '/shop', badge: '' },
    { image: '/images/categories/electronics.jpg', title: lang === 'ar' ? 'الأجهزة الذكية' : 'Smart Gadgets', sub: '', cta: t('home.viewAllProducts'), link: '/shop', badge: '' },
    { image: '/images/categories/gadgets.jpg', title: lang === 'ar' ? 'عروض حصرية' : 'Exclusive Deals', sub: '', cta: t('home.viewAllProducts'), link: '/shop', badge: '' },
  ];

  useEffect(() => {
    const id = setInterval(() => {
      if (paused.current) return;
      setIndex((i) => (i + 1) % slides.length);
    }, 4500);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <section
      className="relative bg-white"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <div className="max-w-7xl mx-auto px-3 md:px-4 py-3 md:py-4">
        <div className="relative rounded-xl md:rounded-2xl overflow-hidden aspect-[16/7] md:aspect-[21/8] bg-cream">
          <div
            className="flex h-full transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((s, i) => (
              <div key={i} className="relative h-full w-full shrink-0">
                <img src={s.image} alt="" className="h-full w-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
                <div className="absolute inset-0 bg-gradient-to-r from-ink/45 via-ink/10 to-transparent rtl:bg-gradient-to-l flex items-center">
                  <div className="px-5 md:px-12 max-w-md">
                    {s.badge && (
                      <span className="inline-flex items-center gap-1 chip bg-brand-500 text-white text-xs mb-3">
                        <Zap size={12} /> {s.badge} {t('misc.sale')}
                      </span>
                    )}
                    <h1 className="text-lg sm:text-3xl md:text-4xl font-extrabold text-white leading-tight drop-shadow-sm">{s.title}</h1>
                    {s.sub && <p className="mt-1.5 md:mt-2 text-white/80 text-[11px] sm:text-sm md:text-base">{s.sub}</p>}
                    <Link to={s.link} className="btn-primary !px-5 md:!px-6 !py-2.5 md:!py-3 !text-xs sm:!text-sm mt-3 md:mt-4 !rounded-lg">
                      {s.cta}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Arrows */}
          <button
            onClick={() => setIndex((index - 1 + slides.length) % slides.length)}
            className="absolute start-2 top-1/2 -translate-y-1/2 hidden md:flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-lift text-ink/70 hover:text-brand-600"
            aria-label="Previous slide"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setIndex((index + 1) % slides.length)}
            className="absolute end-2 top-1/2 -translate-y-1/2 hidden md:flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-lift text-ink/70 hover:text-brand-600"
            aria-label="Next slide"
          >
            <ChevronRight size={20} />
          </button>

          {/* Dots */}
          <div className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------- Flash sale (premium Daraz — dark countdown boxes) ----------------
function FlashSaleSection({ data }: { data: HomeData }) {
  const t = useT();
  const { lang } = useI18n();
  const { d, h, m, s, done } = useCountdown(data.flashSale!.endsAt);
  const title = lang === 'ar' && data.flashSale!.title ? data.flashSale!.title : data.flashSale!.title || t('home.flashSale');

  return (
    <section className="max-w-7xl mx-auto px-3 md:px-4 py-2">
      <div className="bg-white rounded-xl md:rounded-2xl shadow-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3.5 bg-gradient-to-r from-brand-500 via-brand-500 to-brand-600 text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center shadow-inner">
              <Zap size={20} className="fill-white/30" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-extrabold leading-none">{title}</h2>
              <p className="text-[11px] text-white/75 mt-1">{t('home.flashEndsIn')}</p>
            </div>
          </div>
          {!done && (
            <div className="flex items-center gap-1.5">
              <FlashBox v={d} l={t('home.days')} />
              <span className="text-white/90 font-extrabold text-lg">:</span>
              <FlashBox v={h} l={t('home.hours')} />
              <span className="text-white/90 font-extrabold text-lg">:</span>
              <FlashBox v={m} l={t('home.minutes')} />
              <span className="text-white/90 font-extrabold text-lg">:</span>
              <FlashBox v={s} l={t('home.seconds')} />
            </div>
          )}
          <Link to="/shop" className="text-[13px] font-bold bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 transition-colors">
            {t('common.viewAll')} →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 p-3">
          {data.flashSale!.items.slice(0, 8).map((p, i) => (
            <div key={p.id} className="relative">
              <div className="absolute top-2 start-2 z-10 chip bg-brand-500 text-white text-[10px] shadow-sm">
                -{p.discountPercent}%
              </div>
              <ProductCard product={p} priority={i < 2} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FlashBox({ v, l }: { v: number; l: string }) {
  return (
    <div className="bg-[#212121] rounded-lg px-2 py-1.5 text-center min-w-[46px] shadow-md">
      <div className="text-lg font-extrabold tabular-nums leading-none text-white">{String(v).padStart(2, '0')}</div>
      <div className="text-[9px] uppercase tracking-wide text-white/60 mt-0.5">{l}</div>
    </div>
  );
}

// ---------------- Categories (SLIDING carousel — not all in one place) ----------------
function CategoriesSection({ data }: { data: HomeData }) {
  const t = useT();
  const cats = data.categories;
  if (!cats.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-3 md:px-4 py-3">
      <div className="bg-white rounded-xl md:rounded-2xl shadow-card p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base md:text-lg font-extrabold text-ink flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600 inline-block" />
            {t('home.categories')}
          </h2>
          <Link to="/shop" className="text-xs font-bold text-brand-600 hover:underline">{t('misc.viewAllCategories')}</Link>
        </div>

        <SlideCarousel autoMs={4000}>
          {cats.map((c) => (
            <Link
              key={c.slug}
              to={`/category/${c.slug}`}
              className="group w-[28%] sm:w-[22%] md:w-[18%] lg:w-[15%] shrink-0 snap-start text-center"
            >
              <div className="relative mx-auto aspect-square w-full max-w-[120px] rounded-full overflow-hidden bg-cream ring-2 ring-ink/5 group-hover:ring-brand-400 shadow-sm transition-all duration-300 group-hover:shadow-lift group-hover:-translate-y-0.5">
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt={c.name} loading="lazy" className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-400" />
                ) : (
                  <div className="h-full w-full skeleton" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="mt-2 text-[11px] md:text-[13px] font-semibold text-ink/75 group-hover:text-brand-600 line-clamp-1 transition-colors">{c.name}</p>
            </Link>
          ))}
        </SlideCarousel>
      </div>
    </section>
  );
}

// ---------------- Product row (SLIDING carousel) ----------------
function ProductRow({ title, products, link }: { title: string; products: Product[]; link: string }) {
  const t = useT();
  return (
    <section className="max-w-7xl mx-auto px-3 md:px-4 py-3">
      <div className="bg-white rounded-xl md:rounded-2xl shadow-card p-3 md:p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base md:text-lg font-extrabold text-ink flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600 inline-block" />
            {title}
          </h2>
          <Link to={link} className="text-xs font-bold text-brand-600 hover:underline">{t('common.viewAll')}</Link>
        </div>
        <SlideCarousel autoMs={5000} className="-mx-1 px-1">
          {products.map((p, i) => (
            <div key={p.id} className="w-[44%] sm:w-[31%] md:w-[24.5%] lg:w-[19.5%] shrink-0 snap-start">
              <ProductCard product={p} priority={i < 4} />
            </div>
          ))}
        </SlideCarousel>
      </div>
    </section>
  );
}

// ---------------- Just For You (Daraz signature grid) ----------------
function JustForYouGrid({ products }: { products: Product[] | null }) {
  const t = useT();
  return (
    <section className="max-w-7xl mx-auto px-3 md:px-4 py-3">
      <div className="bg-white rounded-xl md:rounded-2xl shadow-card p-3 md:p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
          <h2 className="text-base md:text-lg font-extrabold text-ink">Just For You</h2>
        </div>
        {!products ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 md:gap-3">
            {[...Array(10)].map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 md:gap-3">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 5} />
            ))}
          </div>
        )}
        <div className="mt-5 text-center">
          <Link to="/shop" className="inline-flex items-center gap-2 px-10 py-2.5 text-sm font-bold rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors">
            {t('home.viewAllProducts')} →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------------- Reviews ----------------
function ReviewsSection({ reviews }: { reviews: HomeData['reviews'] }) {
  const t = useT();
  return (
    <section className="max-w-7xl mx-auto px-3 md:px-4 py-3">
      <div className="bg-white rounded-xl md:rounded-2xl shadow-card p-4">
        <h2 className="text-base md:text-lg font-extrabold mb-3">{t('home.reviews')}</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <div key={r.id} className="border border-ink/5 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Stars value={r.rating} />
                {r.isDemo && <span className="chip bg-brand-50 text-brand-600 text-[9px]">{t('common.demo')}</span>}
              </div>
              {r.title && <p className="font-bold text-sm">{r.title}</p>}
              <p className="text-sm text-ink/60 leading-relaxed line-clamp-3">“{r.content}”</p>
              <div className="mt-auto flex items-center gap-2 pt-2 border-t border-ink/5">
                <span className="h-8 w-8 rounded-full bg-brand-50 text-brand-600 font-bold text-xs flex items-center justify-center">{r.displayName.charAt(0)}</span>
                <div>
                  <p className="text-xs font-bold">{r.displayName}</p>
                  {r.product && (
                    <Link to={`/product/${r.product.slug}`} className="text-[11px] text-brand-600 hover:underline line-clamp-1">
                      {r.product.title}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------- FAQ ----------------
function FaqSection({ section }: { section: HomepageSectionDto }) {
  const t = useT();
  const { lang } = useI18n();
  const [open, setOpen] = useState<number | null>(0);
  const faqs = (section.config?.faqs as { q: string; a: string; qAr?: string; aAr?: string }[]) || [];
  if (!faqs.length) return null;

  return (
    <section className="max-w-3xl mx-auto px-3 md:px-4 py-3">
      <div className="bg-white rounded-xl md:rounded-2xl shadow-card p-4">
        <h2 className="text-base md:text-lg font-extrabold mb-3">{lang === 'ar' && section.titleAr ? section.titleAr! : section.title || t('home.faq')}</h2>
        <div className="grid gap-2">
          {faqs.map((f, i) => (
            <div key={i} className="border border-ink/8 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between gap-3 p-3.5 text-start font-semibold text-sm hover:bg-brand-50/40"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span>{lang === 'ar' && f.qAr ? f.qAr : f.q}</span>
                <ChevronLeft className={`shrink-0 transition-transform ${open === i ? '-rotate-90' : 'rotate-180'} rtl:rotate-0 ${open === i ? 'rtl:rotate-90' : 'rtl:-rotate-90'}`} size={17} />
              </button>
              {open === i && (
                <div className="px-4 pb-4 text-sm text-ink/60 leading-relaxed animate-fade-in">
                  {lang === 'ar' && f.aAr ? f.aAr : f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------- Newsletter ----------------
function NewsletterSection() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    setBusy(true);
    try {
      await api.post('/api/newsletter/subscribe', { email });
      setDone(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-3 md:px-4 py-3">
      <div className="rounded-xl md:rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 text-white px-5 py-8 md:px-10 text-center relative overflow-hidden">
        <div className="absolute -top-20 -end-20 h-56 w-56 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 -start-20 h-64 w-64 rounded-full bg-white/10" />
        <div className="relative max-w-lg mx-auto">
          <h3 className="text-xl md:text-2xl font-extrabold">{t('home.newsletterTitle')}</h3>
          <p className="text-white/75 text-sm mt-2">{t('home.newsletterSub')}</p>
          {done ? (
            <p className="mt-5 text-white font-bold">✓ {t('cart.couponApplied')} — {t('popup.discountSub', { code: 'WELCOME10' })}</p>
          ) : (
            <form onSubmit={subscribe} className="mt-5 flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('home.newsletterPlaceholder')}
                className="flex-1 rounded-lg bg-white/15 border border-white/25 px-4 py-2.5 text-sm placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label={t('home.newsletterPlaceholder')}
              />
              <button type="submit" className="btn bg-white text-brand-600 hover:bg-white/90 !py-2.5 !px-6 !rounded-lg" disabled={busy}>
                {busy ? '…' : t('home.newsletterCta')}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------- Skeleton ----------------
function HomeSkeleton() {
  return (
    <div className="pb-10">
      <div className="max-w-7xl mx-auto px-3 md:px-4 py-3">
        <div className="h-44 md:h-64 rounded-xl skeleton" />
      </div>
      <div className="max-w-7xl mx-auto px-3 md:px-4 py-3">
        <div className="bg-white rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
