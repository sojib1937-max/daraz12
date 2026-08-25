// Customer account: orders, profile, addresses, wishlist access.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, LogOut, Heart } from 'lucide-react';
import { api, sessionTokens } from '../lib/api';
import { useT } from '../i18n';
import { useAuth } from '../store';
import { PageLoader, EmptyState, Badge } from '../components/ui';
import { aed, formatDate, ORDER_STATUS_LABELS, emirateName } from '../lib/format';
import type { OrderDto } from '../lib/types';

export function AccountPage() {
  const t = useT();
  const navigate = useNavigate();
  const { customer, setCustomer } = useAuth();
  const [orders, setOrders] = useState<OrderDto[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) {
      navigate('/login');
      return;
    }
    api
      .get<{ items: OrderDto[] }>('/api/orders/my?limit=20')
      .then((d) => setOrders(d.items))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [customer, navigate]);

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      /* ignore */
    }
    sessionTokens.clearCustomer();
    setCustomer(null);
    navigate('/');
  };

  if (!customer) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="card p-6 mb-8 flex flex-wrap items-center gap-5">
        <span className="h-16 w-16 rounded-2xl bg-brand-700 text-white font-extrabold text-xl flex items-center justify-center">
          {customer.name.charAt(0)}
        </span>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-extrabold">{customer.name}</h1>
          <p className="text-sm text-ink/50" dir="ltr">{customer.phone}</p>
          {customer.email && <p className="text-sm text-ink/50">{customer.email}</p>}
        </div>
        <div className="flex gap-2">
          <Link to="/wishlist" className="btn-outline !py-2.5 !px-4 text-sm">
            <Heart size={16} /> {t('account.wishlist')}
          </Link>
          <button className="btn-outline !py-2.5 !px-4 text-sm !text-red-500 !border-red-200" onClick={logout}>
            <LogOut size={16} /> {t('auth.logout')}
          </button>
        </div>
      </div>

      <h2 className="font-extrabold text-lg mb-4 flex items-center gap-2">
        <Package size={19} className="text-brand-700" /> {t('account.orderHistory')}
      </h2>
      {loading ? (
        <PageLoader />
      ) : !orders || orders.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title={t('account.noOrders')}
          action={<Link to="/shop" className="btn-primary !py-2.5 !px-5 text-sm">{t('cart.startShopping')}</Link>}
        />
      ) : (
        <div className="grid gap-3">
          {orders.map((o) => (
            <Link key={o.id} to={`/track-order?orderId=${o.orderNumber}`} className="card p-4 flex flex-wrap items-center gap-4 hover:shadow-lift transition-shadow">
              <div className="flex -space-x-3 rtl:space-x-reverse">
                {o.items.slice(0, 3).map((i, idx) =>
                  i.imageUrl ? (
                    <img key={idx} src={i.imageUrl} alt="" className="h-11 w-11 rounded-xl object-cover border-2 border-white bg-cream" />
                  ) : (
                    <span key={idx} className="h-11 w-11 rounded-xl bg-cream border-2 border-white" />
                  )
                )}
              </div>
              <div className="flex-1 min-w-[140px]">
                <p className="font-extrabold text-brand-800" dir="ltr">{o.orderNumber}</p>
                <p className="text-xs text-ink/45">{formatDate(o.placedAt, { withTime: true })} • {emirateName(o.emirate)}</p>
              </div>
              <div className="text-end">
                <p className="font-bold">{aed(o.total)}</p>
                <Badge color={ORDER_STATUS_LABELS[o.status]?.color}>{ORDER_STATUS_LABELS[o.status]?.en}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
