// Wishlist page (requires sign-in).
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { api } from '../lib/api';
import { useT } from '../i18n';
import { useAuth } from '../store';
import { PageLoader, EmptyState } from '../components/ui';
import { ProductCard } from '../components/storefront/ProductCard';
import type { Product } from '../lib/types';

export function WishlistPage() {
  const t = useT();
  const navigate = useNavigate();
  const { customer } = useAuth();
  const [items, setItems] = useState<{ id: number; product: Product }[] | null>(null);

  useEffect(() => {
    if (!customer) {
      navigate('/login');
      return;
    }
    api
      .get<{ id: number; product: Product }[]>('/api/wishlist')
      .then(setItems)
      .catch(() => setItems([]));
  }, [customer, navigate]);

  if (!customer) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold mb-6 flex items-center gap-2">
        <Heart className="text-red-500 fill-red-500" size={22} /> {t('account.wishlist')}
      </h1>
      {!items ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Heart />}
          title={t('account.emptyWishlist')}
          action={<Link to="/shop" className="btn-primary !py-2.5 !px-5 text-sm">{t('cart.startShopping')}</Link>}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((i) => (
            <div key={i.id}>
              <ProductCard product={i.product} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
