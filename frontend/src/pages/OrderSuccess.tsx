// Order confirmation page with COD notice + tracking link.
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, Banknote, Truck, PackageSearch, MessageCircle } from 'lucide-react';
import { useT, useLang } from '../i18n';
import { useSite } from '../store';
import { aed, emirateName, waLink } from '../lib/format';

interface OrderSummary {
  orderNumber: string;
  total: number;
  deliveryEstimate: string | null;
  emirate: string;
  customerName: string;
  status?: string;
}

export function OrderSuccess() {
  const t = useT();
  const lang = useLang();
  const { orderNumber } = useParams();
  const location = useLocation();
  const { settings } = useSite();
  const order = (location.state as { order?: OrderSummary } | null)?.order;

  const displayNumber = order?.orderNumber || orderNumber || '';
  const wa = String(settings?.['store.whatsapp'] || '');

  return (
    <div className="max-w-xl mx-auto px-4 py-14 md:py-20 text-center">
      <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-emerald-100 mb-6 animate-pop-in">
        <CheckCircle2 className="text-emerald-600" size={44} />
      </div>
      <h1 className="text-2xl md:text-3xl font-extrabold">{t('success.title')}</h1>
      <p className="text-ink/55 mt-2">{t('success.sub')}</p>

      <div className="card p-6 mt-8 text-start">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="label">{t('success.orderNumber')}</p>
            <p className="font-extrabold text-brand-800 break-all" dir="ltr">{displayNumber}</p>
          </div>
          <div>
            <p className="label">{t('success.total')}</p>
            <p className="font-extrabold text-brand-800">{aed(order?.total ?? 0)}</p>
          </div>
          <div>
            <p className="label">{t('success.deliveryTo')}</p>
            <p className="text-sm font-semibold">{order ? emirateName(order.emirate, lang) : '—'}</p>
          </div>
          <div>
            <p className="label">{t('success.estimate')}</p>
            <p className="text-sm font-semibold">{order?.deliveryEstimate || '1-3 business days'}</p>
          </div>
        </div>
        <div className="mt-5 bg-gold-50 border border-gold-200 rounded-xl p-4 text-sm text-gold-800 flex gap-3">
          <Banknote className="shrink-0 mt-0.5" size={18} />
          <p>{t('success.codNotice')}</p>
        </div>
      </div>

      <div className="grid gap-3 mt-6 sm:grid-cols-2">
        <Link to={`/track-order?orderId=${displayNumber}`} className="btn-primary !py-3.5">
          <PackageSearch size={18} /> {t('success.trackOrder')}
        </Link>
        <Link to="/shop" className="btn-outline !py-3.5">
          <Truck size={18} /> {t('success.continueShopping')}
        </Link>
        {wa && (
          <a href={waLink(wa, `Hello! I placed order ${displayNumber} and have a question.`)} target="_blank" rel="noopener noreferrer" className="btn-outline !py-3.5 sm:col-span-2 !border-[#25D366] !text-[#128C4A]">
            <MessageCircle size={18} /> {t('success.whatsapp')}
          </a>
        )}
      </div>
    </div>
  );
}
