// Premium product detail page: gallery with zoom, variants, qty, sticky
// add-to-cart on mobile, COD info, specs, reviews, related products.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Heart, ShoppingCart, Zap, Truck, Banknote, RotateCcw, ShieldCheck, Check, Star as StarIcon, ZoomIn,
} from 'lucide-react';
import { api } from '../lib/api';
import { useT, useLang } from '../i18n';
import { useDocumentTitle } from '../hooks';
import { ProductCard } from '../components/storefront/ProductCard';
import { ProductJsonLd } from '../components/storefront/Seo';
import { trackPixelEvent } from '../components/storefront/PixelLoader';
import { QtyPicker, Stars, PageLoader, EmptyState } from '../components/ui';
import { useCart, useAuth, useSite, toast } from '../store';
import { aed } from '../lib/format';
import type { Product } from '../lib/types';

interface ReviewDto {
  id: number;
  rating: number;
  title: string | null;
  content: string;
  displayName: string;
  imageUrl: string | null;
  isVerifiedPurchase: boolean;
  isDemo: boolean;
  createdAt: string;
}

export function ProductDetail() {
  const { slug } = useParams();
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const cart = useCart();
  const { customer } = useAuth();
  const { settings } = useSite();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [added, setAdded] = useState(false);
  const [reviewForm, setReviewForm] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 5, title: '', content: '' });
  const [reviewBusy, setReviewBusy] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setQty(1);
    setVariantId(null);
    setActiveImg(0);
    api
      .get<{ product: Product; related: Product[] }>(`/api/products/${slug}`)
      .then(async (d) => {
        if (cancelled) return;
        setProduct(d.product);
        setRelated(d.related);
        try {
          const r = await api.get<ReviewDto[]>(`/api/products/${slug}/reviews`);
          if (!cancelled) setReviews(r);
        } catch {
          /* reviews optional */
        }
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Fire ViewContent to configured pixels when the product loads
  useEffect(() => {
    if (!product) return;
    trackPixelEvent('ViewContent', {
      content_id: product.id,
      content_name: product.title,
      value: product.flashPrice ?? product.price,
      currency: 'AED',
    });
  }, [product]);

  useDocumentTitle(product ? `${product.title} — DesertCart UAE` : 'Product — DesertCart');

  const selectedVariant = useMemo(() => product?.variants.find((v) => v.id === variantId) || null, [product, variantId]);
  const effectivePrice = useMemo(() => {
    if (!product) return 0;
    const base = product.flashPrice ?? product.price;
    return selectedVariant ? base + (selectedVariant.price - product.price) : base;
  }, [product, selectedVariant]);
  const comparePrice = product?.compareAtPrice ?? null;
  const stock = selectedVariant ? selectedVariant.stock : (product?.stock ?? 0);
  const images = product?.images.length ? product.images : product?.thumbnail ? [{ id: -1, url: product.thumbnail, alt: null }] : [];

  if (loading) return <PageLoader />;
  if (error || !product) {
    return <EmptyState icon={<ShoppingCart />} title={t('shop.noResults')} subtitle={error || 'Product not found'} action={<Link to="/shop" className="btn-primary !py-2.5 !px-5 text-sm">{t('cart.startShopping')}</Link>} />;
  }

  const addToCart = (buyNow = false) => {
    if (product.variants.length > 0 && !variantId) {
      toast.info(t('product.selectVariant', { name: 'variant' }));
      return;
    }
    cart.add({
      productId: product.id,
      variantId: variantId ?? null,
      quantity: qty,
      price: effectivePrice,
      title: product.titleEn,
      titleAr: product.titleAr,
      image: images[0]?.url || '',
      slug: product.slug,
      stock,
      variantName: selectedVariant?.name,
    });
    api.post('/api/analytics/event', { type: 'ADD_TO_CART', productId: product.id }).catch(() => undefined);
    trackPixelEvent('AddToCart', { content_id: product.id, content_name: product.title, value: effectivePrice, currency: 'AED' });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
    toast.success(t('product.addedToCart'));
    if (buyNow) navigate('/checkout');
  };

  const submitReview = async () => {
    if (!customer) {
      toast.info(t('product.reviewLogin'));
      return;
    }
    setReviewBusy(true);
    try {
      await api.post('/api/reviews', {
        productId: product.id,
        rating: reviewData.rating,
        title: reviewData.title,
        content: reviewData.content,
      });
      setReviewForm(false);
      toast.success(t('product.reviewSubmitted'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReviewBusy(false);
    }
  };

  const toggleWishlist = async () => {
    if (!customer) {
      toast.info(t('product.needLoginWishlist'));
      return;
    }
    try {
      if (inWishlist) {
        await api.del(`/api/wishlist/${product.id}`);
        setInWishlist(false);
      } else {
        await api.post('/api/wishlist', { productId: product.id });
        setInWishlist(true);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-10 pb-28 md:pb-10">
      <ProductJsonLd product={product} />
      <nav className="text-xs text-ink/45 mb-5 flex items-center gap-1.5 flex-wrap" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-brand-700">{t('nav.home')}</Link>
        <span>/</span>
        {product.category && <Link to={`/category/${product.category.slug}`} className="hover:text-brand-700">{product.category.name}</Link>}
        <span>/</span>
        <span className="text-ink/70 font-semibold line-clamp-1 max-w-[220px]">{product.title}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
        {/* ---------- Gallery ---------- */}
        <div>
          <div
            className="relative aspect-square rounded-3xl overflow-hidden bg-cream border border-ink/5 cursor-zoom-in group"
            onClick={() => setZoom(!zoom)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setZoom(!zoom)}
            aria-label="Zoom product image"
          >
            <img
              src={images[activeImg]?.url || ''}
              alt={product.title}
              className={`h-full w-full object-cover transition-transform duration-300 ${zoom ? 'scale-[1.8]' : 'scale-100'}`}
              style={zoom ? { transformOrigin: '50% 50%' } : undefined}
            />
            <span className="absolute top-3 end-3 p-2 rounded-full bg-white/85 shadow-card text-ink/50">
              <ZoomIn size={17} />
            </span>
            {product.flashPrice != null && (
              <span className="absolute top-3 start-3 chip bg-red-600 text-white">
                <Zap size={11} /> {t('product.flashDeal')}
              </span>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2.5 mt-3 overflow-x-auto no-scrollbar pb-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImg(i)}
                  className={`h-20 w-20 rounded-xl overflow-hidden border-2 transition-colors shrink-0 ${activeImg === i ? 'border-brand-600' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  aria-label={`Image ${i + 1}`}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ---------- Info ---------- */}
        <div>
          {product.brand && <p className="text-xs font-bold uppercase tracking-widest text-brand-700 mb-1">{product.brand.name}</p>}
          <h1 className="text-2xl md:text-3xl font-extrabold text-ink leading-tight">{product.title}</h1>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Stars value={product.ratingAvg} size={16} />
            <span className="text-sm font-bold">{product.ratingAvg.toFixed(1)}</span>
            {product.ratingCount > 0 && <span className="text-sm text-ink/45">({product.ratingCount} {t('product.reviews').toLowerCase()})</span>}
            <span className="text-sm text-ink/45">•</span>
            <span className="text-sm text-ink/45">{t('product.sold', { n: product.soldCount })}</span>
          </div>

          <div className="mt-5 flex items-end gap-3 flex-wrap">
            <span className="text-3xl md:text-4xl font-extrabold text-brand-800">{aed(effectivePrice)}</span>
            {comparePrice && comparePrice > effectivePrice && (
              <>
                <span className="text-lg text-ink/35 line-through">{aed(comparePrice)}</span>
                {product.discountPercent != null && (
                  <span className="chip bg-red-100 text-red-600 text-xs">-{product.discountPercent}%</span>
                )}
              </>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 text-sm">
            {stock > 0 ? (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse-soft" />
                <span className="font-semibold text-emerald-700">{stock <= product.lowStockThreshold ? t('common.lowStock', { n: stock }) : t('common.inStock')}</span>
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="font-semibold text-red-600">{t('common.outOfStock')}</span>
              </>
            )}
          </div>

          {product.variants.length > 0 && (
            <div className="mt-5">
              <p className="label">Options</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVariantId(v.id)}
                    disabled={v.stock <= 0}
                    className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-colors ${variantId === v.id ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-ink/10 hover:border-ink/25'} ${v.stock <= 0 ? 'opacity-40 line-through' : ''}`}
                  >
                    {v.name}
                    {v.stock <= 0 && ' — 0'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.description && (
            <p className="mt-5 text-[15px] leading-relaxed text-ink/65 whitespace-pre-line">{product.description}</p>
          )}

          <div className="mt-7 flex items-center gap-3">
            <QtyPicker value={qty} onChange={setQty} max={Math.min(50, stock || 50)} />
            <button className="btn-primary flex-1 !py-3.5 text-[15px] hidden md:inline-flex" disabled={stock <= 0 || added} onClick={() => addToCart(false)}>
              {added ? <Check size={18} /> : <ShoppingCart size={18} />}
              {added ? '✓' : t('common.addToCart')}
            </button>
            <button className="btn-buy flex-1 !py-3.5 text-[15px] hidden md:inline-flex" disabled={stock <= 0} onClick={() => addToCart(true)}>
              {t('common.buyNow')}
            </button>
            <button
              onClick={toggleWishlist}
              className={`btn-outline !p-3.5 ${inWishlist ? '!text-red-500 !border-red-200' : ''}`}
              aria-label={t('nav.wishlist')}
            >
              <Heart size={19} className={inWishlist ? 'fill-red-500' : ''} />
            </button>
          </div>

          <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
            <TrustLine icon={<Banknote size={17} />} title={t('product.codNote')} sub={t('home.trustCodSub')} />
            <TrustLine icon={<Truck size={17} />} title={t('product.deliveryInfo')} sub={String(settings?.['shipping.deliveryEstimateDays'] || '1-3 business days')} />
            <TrustLine icon={<ShieldCheck size={17} />} title={t('common.secureCheckout')} sub={t('checkout.trust2')} />
            <TrustLine icon={<RotateCcw size={17} />} title={t('common.easyReturns')} sub={t('home.trustReturnsSub')} />
          </div>
          {product.shippingNote && (
            <p className="mt-3 text-xs text-ink/45">📦 {t('product.shippingNote')}: {product.shippingNote}</p>
          )}
        </div>
      </div>

      {/* ---------- Details & specs ---------- */}
      <div className="mt-12 grid lg:grid-cols-2 gap-8">
        <div className="card p-6">
          <h2 className="font-extrabold text-lg mb-4">{t('product.details')}</h2>
          <p className="text-sm leading-relaxed text-ink/65 whitespace-pre-line">{product.description || '—'}</p>
        </div>
        {product.specifications && product.specifications.length > 0 && (
          <div className="card p-6">
            <h2 className="font-extrabold text-lg mb-4">{t('product.specifications')}</h2>
            <table className="table-base">
              <tbody>
                {product.specifications.map((s, i) => (
                  <tr key={i} className="!border-ink/5">
                    <td className="!py-2.5 font-semibold text-ink/55 w-2/5">{s.label}</td>
                    <td className="!py-2.5">{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- Reviews ---------- */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-extrabold">{t('product.reviews')} ({reviews.length})</h2>
          {!reviewForm && (
            <button
              className="btn-outline !py-2 !px-4 text-sm"
              onClick={() => {
                if (!customer) {
                  toast.info(t('product.reviewLogin'));
                  navigate('/login');
                  return;
                }
                setReviewForm(true);
              }}
            >
              {t('product.writeReview')}
            </button>
          )}
        </div>

        {reviewForm && (
          <div className="card p-5 mb-5 max-w-xl">
            <p className="label">{t('product.yourRating')}</p>
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} onClick={() => setReviewData({ ...reviewData, rating: i })} aria-label={`${i} stars`}>
                  <StarIcon size={24} className={i <= reviewData.rating ? 'fill-gold-500 text-gold-500' : 'text-ink/20'} />
                </button>
              ))}
            </div>
            <input value={reviewData.title} onChange={(e) => setReviewData({ ...reviewData, title: e.target.value })} placeholder={t('product.reviewTitle')} className="input mb-3" maxLength={100} />
            <textarea value={reviewData.content} onChange={(e) => setReviewData({ ...reviewData, content: e.target.value })} placeholder={t('product.reviewContent')} className="input mb-3 min-h-[100px]" maxLength={1000} />
            <button className="btn-primary !py-2.5 !px-5 text-sm" onClick={submitReview} disabled={reviewBusy || reviewData.content.length < 5}>
              {t('product.submitReview')}
            </button>
          </div>
        )}

        {reviews.length === 0 ? (
          <p className="text-sm text-ink/45">{t('product.noReviews')}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <Stars value={r.rating} />
                  {r.isDemo && <span className="chip bg-gold-100 text-gold-700 text-[9px]">{t('common.demo')}</span>}
                </div>
                {r.title && <p className="font-bold text-sm">{r.title}</p>}
                <p className="text-sm text-ink/60 mt-1.5 leading-relaxed">{r.content}</p>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-ink/5">
                  <span className="h-8 w-8 rounded-full bg-brand-50 text-brand-700 font-bold text-xs flex items-center justify-center">{r.displayName.charAt(0)}</span>
                  <div>
                    <p className="text-xs font-bold">{r.displayName}</p>
                    {r.isVerifiedPurchase && (
                      <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                        <Check size={10} /> {t('product.verifiedPurchase')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Related ---------- */}
      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-extrabold mb-5">{t('product.related')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {related.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 2} />
            ))}
          </div>
        </div>
      )}

      {/* ---------- Sticky mobile CTA (Daraz/AliExpress style — red Buy Now) ---------- */}
      <div className="fixed bottom-0 inset-x-0 z-[75] bg-white/95 backdrop-blur border-t border-ink/8 p-2.5 md:hidden pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2.5">
          <div className="shrink-0 min-w-[70px]">
            <p className="text-[15px] font-extrabold text-brand-800 leading-none">{aed(effectivePrice)}</p>
            {comparePrice && comparePrice > effectivePrice && <p className="text-[11px] text-ink/35 line-through">{aed(comparePrice)}</p>}
          </div>
          <button className="btn-primary flex-1 !py-3.5 !text-[13px] !rounded-xl" disabled={stock <= 0} onClick={() => addToCart(false)}>
            <ShoppingCart size={18} /> {t('common.addToCart')}
          </button>
          <button className="btn-buy !py-3.5 !px-5 !text-[13px] !rounded-xl shrink-0" disabled={stock <= 0} onClick={() => addToCart(true)}>
            {t('common.buyNow')}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrustLine({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-cream border border-ink/5 px-3.5 py-3">
      <span className="text-brand-700 shrink-0">{icon}</span>
      <div>
        <p className="text-[13px] font-bold">{title}</p>
        <p className="text-[11px] text-ink/50">{sub}</p>
      </div>
    </div>
  );
}
