// Daraz-style product card — white, image, orange discount badge,
// 2-line title, price + strikethrough, sold count, free-delivery tag.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Zap, Truck } from 'lucide-react';
import type { Product } from '../../lib/types';
import { aed } from '../../lib/format';
import { useCart, useAuth, useSite, toast } from '../../store';
import { useT, useLang } from '../../i18n';
import { api } from '../../lib/api';
import { Stars } from '../ui';
import { trackPixelEvent } from './PixelLoader';

export function ProductCard({ product, priority }: { product: Product; priority?: boolean }) {
  const t = useT();
  const lang = useLang();
  const cart = useCart();
  const { customer } = useAuth();
  const { settings } = useSite();
  const [inWishlist, setInWishlist] = useState(false);
  const [wishBusy, setWishBusy] = useState(false);
  const img = product.thumbnail || product.images[0]?.url || '';
  const effectivePrice = product.flashPrice ?? product.price;
  const isNew = Date.now() - new Date(product.createdAt).getTime() < 30 * 86400000;
  const freeShipThreshold = Number(settings?.['shipping.freeShippingThreshold'] || 0);
  const freeDelivery = freeShipThreshold > 0 && effectivePrice >= freeShipThreshold;
  const sold = product.soldCount;

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!customer) {
      toast.info(t('product.needLoginWishlist'));
      return;
    }
    if (wishBusy) return;
    setWishBusy(true);
    try {
      if (inWishlist) {
        await api.del(`/api/wishlist/${product.id}`);
        setInWishlist(false);
        toast.success(t('product.removedFromWishlist'));
      } else {
        await api.post('/api/wishlist', { productId: product.id });
        setInWishlist(true);
        toast.success(t('product.addedToWishlist'));
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setWishBusy(false);
    }
  };

  const addToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    cart.add({
      productId: product.id,
      quantity: 1,
      price: effectivePrice,
      title: product.titleEn,
      titleAr: product.titleAr,
      image: img,
      slug: product.slug,
      stock: product.stock,
    });
    trackPixelEvent('AddToCart', { content_id: product.id, content_name: product.title, value: effectivePrice, currency: 'AED' });
    toast.success(t('product.addedToCart'));
  };

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group relative bg-white rounded-xl overflow-hidden border border-ink/5 md:hover:shadow-lift md:hover:-translate-y-0.5 transition-all duration-200 flex flex-col focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      {/* Image */}
      <div className="relative aspect-square bg-cream overflow-hidden">
        {img ? (
          <img
            src={img}
            alt={product.title}
            loading={priority ? 'eager' : 'lazy'}
            className="h-full w-full object-cover md:group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="h-full w-full skeleton" />
        )}

        {/* Discount badge (Daraz orange) */}
        {product.discountPercent != null && product.discountPercent > 0 && (
          <span className="absolute top-1.5 start-1.5 chip bg-brand-500 text-white text-[10px]">
            -{product.discountPercent}%
          </span>
        )}
        {product.flashPrice != null && (
          <span className="absolute top-1.5 start-1.5 chip bg-red-600 text-white text-[10px]">
            <Zap size={10} /> {t('product.flashDeal')}
          </span>
        )}

        {/* Wishlist */}
        <button
          onClick={toggleWishlist}
          className={`absolute top-1.5 end-1.5 p-1.5 rounded-full bg-white/90 shadow-sm backdrop-blur transition-colors ${inWishlist ? 'text-red-500' : 'text-ink/50 hover:text-red-500'}`}
          aria-label={t('nav.wishlist')}
        >
          <Heart size={15} className={inWishlist ? 'fill-red-500' : ''} />
        </button>

        {/* Hover add-to-cart (desktop) */}
        {product.stock > 0 && (
          <button
            onClick={addToCart}
            className="absolute bottom-2 end-2 p-2 rounded-full bg-brand-500 text-white shadow-lift opacity-0 translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-200 hover:bg-brand-600 hidden md:block"
            aria-label={t('common.addToCart')}
          >
            <ShoppingCart size={16} />
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-2 md:p-3 flex flex-col gap-1 flex-1">
        <h3 className="text-[12px] md:text-[13px] font-normal text-ink leading-snug line-clamp-2 min-h-[2.4em]" lang={lang}>
          {product.title}
        </h3>

        {/* Price row */}
        <div className="mt-auto pt-1 flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[15px] md:text-base font-extrabold text-brand-600">{aed(effectivePrice, { compact: true })}</span>
          {product.compareAtPrice && product.compareAtPrice > effectivePrice && (
            <span className="text-[11px] text-ink/35 line-through">{aed(product.compareAtPrice, { compact: true })}</span>
          )}
        </div>

        {/* Sold / rating */}
        <div className="flex items-center justify-between text-[10px] text-ink/45">
          <span className="flex items-center gap-1">
            {product.ratingCount > 0 && <Stars value={product.ratingAvg} size={10} />}
          </span>
          {sold > 0 && <span>{sold} {t('product.sold', { n: sold }).replace(String(sold), '').trim() || 'sold'}</span>}
        </div>

        {/* Free delivery tag */}
        {freeDelivery && (
          <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <Truck size={11} /> {t('common.freeShipping')}
          </p>
        )}
        {product.stock > 0 && product.stock <= product.lowStockThreshold && (
          <p className="text-[11px] font-semibold text-orange-600">{t('common.lowStock', { n: product.stock })}</p>
        )}
        {product.stock <= 0 && <p className="text-[11px] font-semibold text-red-500">{t('common.outOfStock')}</p>}
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-ink/5">
      <div className="aspect-square skeleton" />
      <div className="p-3 grid gap-2">
        <div className="h-3 w-full skeleton" />
        <div className="h-3 w-2/3 skeleton" />
        <div className="h-4 w-20 skeleton mt-1" />
      </div>
    </div>
  );
}
