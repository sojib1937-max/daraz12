// Cart page — full cart with coupon, shipping progress, COD highlight.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, Banknote, Tag, X } from 'lucide-react';
import { useCart, useSite, toast } from '../store';
import { useT } from '../i18n';
import { api } from '../lib/api';
import { aed } from '../lib/format';
import { QtyPicker, EmptyState } from '../components/ui';

export function CartPage() {
  const t = useT();
  const cart = useCart();
  const { settings } = useSite();
  const navigate = useNavigate();
  const [couponInput, setCouponInput] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const subtotal = cart.subtotal();
  const freeShipThreshold = Number(settings?.['shipping.freeShippingThreshold'] || 0);
  const remaining = Math.max(0, freeShipThreshold - subtotal);
  const discount = cart.couponDiscount;

  // Sync cart to server (abandoned-cart tracking) debounced
  const syncedRef = useRef(false);
  useEffect(() => {
    if (syncedRef.current || cart.items.length === 0) return;
    syncedRef.current = true;
    const timer = setTimeout(() => {
      api
        .post('/api/cart/sync', {
          guestId: cart.guestId,
          items: cart.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, price: i.price, title: i.title, image: i.image })),
          progress: 'CART',
        })
        .catch(() => undefined);
    }, 1200);
    return () => clearTimeout(timer);
  }, [cart.items, cart.guestId]);

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponBusy(true);
    try {
      const res = await api.post<{ code: string; discount: number; description: string }>('/api/coupons/validate', {
        code: couponInput.trim(),
        subtotal,
        productIds: cart.items.map((i) => i.productId),
      });
      cart.setCoupon(res.code, res.discount);
      toast.success(`${t('cart.couponApplied')} (${res.code}: ${res.description})`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCouponBusy(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <EmptyState
          icon={<ShoppingCart />}
          title={t('cart.empty')}
          subtitle={t('cart.emptySub')}
          action={
            <Link to="/shop" className="btn-primary !py-3 !px-6">
              {t('cart.startShopping')}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      <h1 className="text-2xl md:text-3xl font-extrabold mb-6">{t('cart.title')} ({cart.count()})</h1>

      {freeShipThreshold > 0 && (
        <div className="card mb-6 p-4">
          {remaining > 0 ? (
            <p className="text-sm font-semibold text-brand-800">
              {t('cart.freeShippingProgress', { n: aed(Math.ceil(remaining), { compact: true }).replace('AED ', '') })}
            </p>
          ) : (
            <p className="text-sm font-bold text-emerald-700">{t('cart.freeShippingReached')}</p>
          )}
          <div className="h-2 bg-ink/8 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-600 to-gold-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (subtotal / Math.max(1, freeShipThreshold)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 grid gap-3 content-start">
          {cart.items.map((item) => {
            const lineTotal = item.price * item.quantity;
            return (
              <div key={`${item.productId}-${item.variantId ?? ''}`} className="card p-4 flex gap-4">
                <Link to={`/product/${item.slug || ''}`} className="shrink-0">
                  <img src={item.image || ''} alt={item.title} className="h-24 w-24 rounded-xl object-cover bg-cream" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/product/${item.slug || ''}`} className="font-semibold text-sm leading-snug line-clamp-2 hover:text-brand-700">
                        {item.title}
                      </Link>
                      {item.variantName && <p className="text-xs text-ink/45 mt-1">{item.variantName}</p>}
                    </div>
                    <button
                      className="p-1.5 text-ink/35 hover:text-red-500 shrink-0"
                      onClick={() => cart.remove(item.productId, item.variantId)}
                      aria-label={t('common.remove')}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                    <QtyPicker value={item.quantity} onChange={(q) => cart.setQty(item.productId, q, item.variantId)} max={Math.min(50, item.stock || 50)} />
                    <div className="text-end">
                      <p className="font-extrabold text-brand-800">{aed(lineTotal)}</p>
                      {item.quantity > 1 && <p className="text-xs text-ink/40">{aed(item.price)} each</p>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <button className="justify-self-start text-sm text-ink/45 hover:text-red-500 font-semibold" onClick={cart.clear}>
            {t('cart.removeAll')}
          </button>
        </div>

        <div className="card p-5 h-fit lg:sticky lg:top-24">
          <h2 className="font-extrabold text-lg mb-4">{t('checkout.summary')}</h2>

          {cart.couponCode ? (
            <div className="flex items-center justify-between bg-brand-50 rounded-xl px-3.5 py-2.5 mb-4">
              <span className="text-sm font-bold text-brand-800 flex items-center gap-1.5">
                <Tag size={14} /> {cart.couponCode}
              </span>
              <button onClick={() => cart.setCoupon(null, 0)} className="p-1 text-ink/40 hover:text-red-500" aria-label={t('cart.couponRemoved')}>
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mb-4">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder={t('cart.couponPlaceholder')}
                className="input flex-1 !py-2.5 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                aria-label={t('cart.couponPlaceholder')}
              />
              <button className="btn-outline !py-2.5 !px-4 text-sm" onClick={applyCoupon} disabled={couponBusy}>
                {t('cart.apply')}
              </button>
            </div>
          )}

          <div className="grid gap-2.5 text-sm">
            <Row label={t('cart.subtotal')} value={aed(subtotal)} />
            {discount > 0 && <Row label={t('cart.discount')} value={`-${aed(discount)}`} negative />}
            <Row label={`${t('cart.shipping')} (${t('cart.calculatedAtCheckout')})`} value="—" muted />
            <div className="border-t border-ink/8 my-1" />
            <div className="flex justify-between font-extrabold text-base">
              <span>{t('cart.total')}</span>
              <span className="text-brand-800">{aed(subtotal - discount)}</span>
            </div>
          </div>

          <button className="btn-primary w-full !py-4 text-[15px] mt-5" onClick={() => navigate('/checkout')}>
            <Banknote size={18} /> {t('cart.checkout')}
          </button>
          <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-ink/45">
            <span className="flex items-center gap-1"><Banknote size={12} /> {t('checkout.trust1')}</span>
            <span>•</span>
            <span>{t('checkout.trust2')}</span>
          </div>
          <Link to="/shop" className="block text-center text-sm font-semibold text-brand-700 hover:underline mt-4">
            {t('cart.continueShopping')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, negative, muted }: { label: string; value: string; negative?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? 'text-ink/45' : 'text-ink/65'}>{label}</span>
      <span className={`font-semibold ${negative ? 'text-emerald-600' : ''}`}>{value}</span>
    </div>
  );
}
