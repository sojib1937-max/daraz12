// Order tracking — order ID + mobile → timeline UI.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PackageSearch, Check, Truck, PackageCheck, Box, Send, MapPin, Home as HomeIcon, ClipboardList } from 'lucide-react';
import { api } from '../lib/api';
import { useT, useLang } from '../i18n';
import { aed, ORDER_STATUS_LABELS } from '../lib/format';
import { Badge, Spinner } from '../components/ui';

interface TrackResult {
  orderNumber: string;
  status: string;
  emirate: string;
  deliveryEstimate: string | null;
  placedAt: string;
  total: number;
  isDemo: boolean;
  items: { title: string; quantity: number; unitPrice: number; imageUrl: string | null }[];
  timeline: { status: string; reached: boolean; reachedAt: string | null }[];
  history: { status: string; note: string | null; createdAt: string }[];
}

const TIMELINE_STEPS = [
  { key: 'NEW', icon: ClipboardList, label: 'track.placed' },
  { key: 'CONFIRMED', icon: Check, label: 'track.confirmed' },
  { key: 'PROCESSING', icon: Box, label: 'track.processing' },
  { key: 'SHIPPED', icon: Send, label: 'track.shipped' },
  { key: 'OUT_FOR_DELIVERY', icon: Truck, label: 'track.outForDelivery' },
  { key: 'DELIVERED', icon: HomeIcon, label: 'track.delivered' },
];

export function TrackingPage() {
  const t = useT();
  const lang = useLang();
  const [params] = useSearchParams();
  const [orderId, setOrderId] = useState(params.get('orderId') || '');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<TrackResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const track = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!orderId.trim() || !phone.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.get<TrackResult>(`/api/orders/track?orderId=${encodeURIComponent(orderId.trim())}&phone=${encodeURIComponent(phone.trim())}`);
      setResult(r);
    } catch {
      setError(t('track.notFound'));
    } finally {
      setLoading(false);
    }
  };

  const statusColor = result ? ORDER_STATUS_LABELS[result.status]?.color || 'gray' : 'gray';

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:py-14">
      <div className="text-center mb-8">
        <span className="inline-flex h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 items-center justify-center mb-3">
          <PackageSearch size={28} />
        </span>
        <h1 className="text-2xl md:text-3xl font-extrabold">{t('track.title')}</h1>
        <p className="text-ink/55 text-sm mt-1.5">{t('track.sub')}</p>
      </div>

      <form onSubmit={track} className="card p-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="label">{t('track.orderId')}</label>
          <input className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder={t('track.placeholder')} dir="ltr" />
        </div>
        <div>
          <label className="label">{t('track.phone')}</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XXXXXXXX" inputMode="tel" />
        </div>
        <button className="btn-primary self-end !py-2.5" disabled={loading}>
          {loading ? <Spinner className="h-4 w-4" /> : <PackageSearch size={16} />}
          {t('track.button')}
        </button>
      </form>

      {error && <p className="text-center text-sm text-red-500 mt-6">{error}</p>}

      {result && (
        <div className="mt-8 animate-fade-in">
          <div className="card p-5 mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label">{t('success.orderNumber')}</p>
              <p className="font-extrabold text-lg text-brand-800" dir="ltr">{result.orderNumber}</p>
              {result.isDemo && <span className="chip bg-gold-100 text-gold-700 mt-1">{t('common.demoBadge')}</span>}
            </div>
            <div className="text-end">
              <p className="label">{t('common.cashOnDelivery')}</p>
              <p className="font-extrabold text-lg">{aed(result.total)}</p>
              <Badge color={statusColor}>{ORDER_STATUS_LABELS[result.status]?.en}</Badge>
            </div>
          </div>

          <div className="card p-5 mb-5">
            <p className="label flex items-center gap-1.5"><PackageCheck size={13} /> {t('checkout.items')}</p>
            <div className="grid gap-3">
              {result.items.map((i, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  {i.imageUrl ? <img src={i.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover bg-cream" /> : <div className="h-12 w-12 rounded-lg bg-cream" />}
                  <p className="text-sm font-semibold flex-1">{i.title} × {i.quantity}</p>
                  <span className="text-sm font-bold">{aed(i.unitPrice * i.quantity)}</span>
                </div>
              ))}
            </div>
            {result.deliveryEstimate && (
              <p className="text-xs text-ink/50 mt-3 flex items-center gap-1">
                <MapPin size={12} /> {t('track.estDelivery', { d: result.deliveryEstimate })} • {result.emirate}
              </p>
            )}
          </div>

          <div className="card p-6">
            <p className="label mb-5">{t('track.title')}</p>
            <ol className="relative">
              {TIMELINE_STEPS.map((step, i) => {
                const stage = result.timeline.find((tl) => tl.status === step.key);
                const reached = !!stage?.reached;
                const isLast = i === TIMELINE_STEPS.length - 1;
                return (
                  <li key={step.key} className={`relative flex gap-4 pb-7 ${isLast ? 'pb-0' : ''}`}>
                    {!isLast && (
                      <span className={`absolute top-9 start-[17px] bottom-0 w-0.5 ${reached ? 'bg-brand-600' : 'bg-ink/10'}`} aria-hidden />
                    )}
                    <span
                      className={`relative z-10 h-9 w-9 rounded-full flex items-center justify-center shrink-0 border-2 ${
                        reached ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-ink/15 text-ink/30'
                      }`}
                    >
                      <step.icon size={16} />
                    </span>
                    <div className="pt-1.5">
                      <p className={`font-bold text-sm ${reached ? 'text-ink' : 'text-ink/35'}`}>{t(step.label)}</p>
                      {stage?.reachedAt && <p className="text-xs text-ink/45 mt-0.5">{new Date(stage.reachedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
