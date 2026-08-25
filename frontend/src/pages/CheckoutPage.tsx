// 3-step COD checkout — customer info → delivery info → review → place order.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Banknote, ChevronLeft, ChevronRight, Check, Lock, Truck } from 'lucide-react';
import { useCart, useSite, useAuth, toast } from '../store';
import { useT, useLang } from '../i18n';
import { api, ApiError } from '../lib/api';
import { aed, EMIRATES, emirateName } from '../lib/format';
import { Spinner } from '../components/ui';

type Step = 1 | 2 | 3;

interface Totals {
  subtotal: number;
  shippingFee: number;
  codFee: number;
  discount: number;
  total: number;
  deliveryEstimate: string;
}

export function CheckoutPage() {
  const t = useT();
  const lang = useLang();
  const cart = useCart();
  const { settings } = useSite();
  const { customer } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    email: '',
    emirate: '',
    area: '',
    address: '',
    building: '',
    apartment: '',
    landmark: '',
    notes: '',
  });
  const [totals, setTotals] = useState<Totals | null>(null);
  const [totalsBusy, setTotalsBusy] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [signedIn] = useState(!!customer);

  const subtotal = cart.subtotal();
  const itemCount = cart.count();

  useEffect(() => {
    if (cart.items.length === 0) {
      navigate('/cart');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!form.emirate) return;
    setTotalsBusy(true);
    api
      .post<Totals>('/api/checkout/shipping-estimate', {
        items: cart.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
        emirate: form.emirate,
        couponCode: cart.couponCode || undefined,
      })
      .then(setTotals)
      .catch(() => setTotals(null))
      .finally(() => setTotalsBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.emirate, cart.couponCode]);

  const syncCart = (progress: string) => {
    api
      .post('/api/cart/sync', {
        guestId: cart.guestId,
        items: cart.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, price: i.price, title: i.title, image: i.image })),
        progress,
      })
      .catch(() => undefined);
  };

  const validateStep = (s: Step): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (form.name.trim().length < 2) e.name = t('common.required');
      const phoneDigits = form.phone.replace(/\D/g, '');
      if (!/^(05\d{8}|9715\d{8}|\+9715\d{8})$/.test(form.phone.trim()) && phoneDigits.length !== 12) e.phone = 'Enter a valid UAE mobile (05XXXXXXXX)';
      if (settings?.['checkout.emailRequired'] && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = t('common.required');
    }
    if (s === 2) {
      if (!form.emirate) e.emirate = t('common.required');
      if (form.area.trim().length < 2) e.area = t('common.required');
      if (form.address.trim().length < 5) e.address = t('common.required');
      if (form.building.trim().length < 1) e.building = t('common.required');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validateStep(step)) return;
    if (step === 1) syncCart('CUSTOMER_INFO');
    if (step === 2) syncCart('DELIVERY');
    setStep((s) => Math.min(3, s + 1) as Step);
    window.scrollTo({ top: 0 });
  };

  const placeOrder = async () => {
    setPlacing(true);
    try {
      const res = await api.post<{ order: { orderNumber: string; total: number; status: string; deliveryEstimate: string | null; emirate: string; customerName: string } }>('/api/checkout/cod', {
        items: cart.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
        customer: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          emirate: form.emirate,
          area: form.area.trim(),
          address: form.address.trim(),
          building: form.building.trim(),
          apartment: form.apartment.trim() || undefined,
          landmark: form.landmark.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
        couponCode: cart.couponCode || undefined,
        guestId: cart.guestId,
        progress: 'REVIEW',
      });
      cart.clear();
      navigate(`/order-success/${res.order.orderNumber}`, { state: { order: res.order } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        toast.error(err.message);
      } else {
        toast.error((err as Error).message);
      }
    } finally {
      setPlacing(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [k]: e.target.value });
    setErrors((prev) => ({ ...prev, [k]: '' }));
  };

  const steps = [t('checkout.step1'), t('checkout.step2'), t('checkout.step3')];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
      <h1 className="text-2xl md:text-3xl font-extrabold mb-6">{t('checkout.title')}</h1>

      <ol className="flex items-center gap-2 mb-8 max-w-xl" aria-label="Checkout steps">
        {steps.map((label, i) => {
          const n = (i + 1) as Step;
          const active = step === n;
          const done = step > n;
          return (
            <li key={n} className="flex items-center gap-2 flex-1">
              <span
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${done ? 'bg-brand-600 text-white' : active ? 'bg-brand-700 text-white ring-4 ring-brand-100' : 'bg-ink/8 text-ink/40'}`}
              >
                {done ? <Check size={15} /> : n}
              </span>
              <span className={`text-xs font-semibold ${active ? 'text-ink' : 'text-ink/40'} hidden sm:block`}>{label}</span>
              {n < 3 && <span className={`h-px flex-1 ${done ? 'bg-brand-600' : 'bg-ink/10'}`} />}
            </li>
          );
        })}
      </ol>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {step === 1 && (
            <section className="card p-6 animate-fade-in">
              <h2 className="font-extrabold text-lg mb-5">{t('checkout.step1')}</h2>
              {!signedIn && (
                <p className="text-xs text-ink/50 mb-4">
                  {t('auth.registerNote')}{' '}
                  <Link to="/login" className="text-brand-700 font-bold underline">{t('auth.login')}</Link>
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('checkout.fullName')} error={errors.name}>
                  <input className="input" value={form.name} onChange={set('name')} autoComplete="name" />
                </Field>
                <Field label={t('checkout.mobile')} error={errors.phone}>
                  <input className="input" value={form.phone} onChange={set('phone')} placeholder="05XXXXXXXX" inputMode="tel" autoComplete="tel" />
                  <p className="text-[11px] text-ink/40 mt-1">{t('checkout.phoneHelp')}</p>
                </Field>
                <div className="sm:col-span-2">
                  <Field label={`${t('checkout.email')} (${t('common.optional')})`} error={errors.email}>
                    <input className="input" value={form.email} onChange={set('email')} type="email" autoComplete="email" />
                  </Field>
                </div>
              </div>
              <button className="btn-primary !px-8 !py-3 mt-6" onClick={next}>
                {t('checkout.next')} <ChevronRight size={17} className="rtl:rotate-180" />
              </button>
            </section>
          )}

          {step === 2 && (
            <section className="card p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-extrabold text-lg">{t('checkout.step2')}</h2>
                <button className="text-sm font-semibold text-brand-700 hover:underline" onClick={() => setStep(1)}>
                  {t('checkout.edit')}
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('checkout.emirate')} error={errors.emirate}>
                  <select className="input" value={form.emirate} onChange={set('emirate')}>
                    <option value="">{t('checkout.selectEmirate')}</option>
                    {EMIRATES.map((e) => (
                      <option key={e.key} value={e.key}>
                        {lang === 'ar' ? e.ar : e.en}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('checkout.area')} error={errors.area}>
                  <input className="input" value={form.area} onChange={set('area')} placeholder="e.g. Al Barsha 1" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t('checkout.address')} error={errors.address}>
                    <input className="input" value={form.address} onChange={set('address')} placeholder="Street, district…" />
                  </Field>
                </div>
                <Field label={t('checkout.building')} error={errors.building}>
                  <input className="input" value={form.building} onChange={set('building')} />
                </Field>
                <Field label={`${t('checkout.apartment')}`}>
                  <input className="input" value={form.apartment} onChange={set('apartment')} />
                </Field>
                <Field label={`${t('checkout.landmark')}`}>
                  <input className="input" value={form.landmark} onChange={set('landmark')} />
                </Field>
                {settings?.['checkout.notesEnabled'] !== false && (
                  <div className="sm:col-span-2">
                    <Field label={`${t('checkout.notes')}`}>
                      <textarea className="input min-h-[80px]" value={form.notes} onChange={set('notes')} placeholder={t('checkout.notesPlaceholder')} />
                    </Field>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button className="btn-outline !px-6 !py-3" onClick={() => setStep(1)}>
                  <ChevronLeft size={17} className="rtl:rotate-180" /> {t('checkout.back')}
                </button>
                <button className="btn-primary !px-8 !py-3" onClick={next}>
                  {t('checkout.reviewOrder')} <ChevronRight size={17} className="rtl:rotate-180" />
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="card p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-extrabold text-lg">{t('checkout.step3')}</h2>
                <button className="text-sm font-semibold text-brand-700 hover:underline" onClick={() => setStep(1)}>
                  {t('checkout.edit')}
                </button>
              </div>

              <div className="bg-cream rounded-xl p-4 mb-4">
                <p className="label">{t('checkout.step1')}</p>
                <p className="text-sm font-semibold">{form.name} — {form.phone}</p>
                {form.email && <p className="text-xs text-ink/50">{form.email}</p>}
              </div>

              <div className="bg-cream rounded-xl p-4 mb-4">
                <p className="label flex items-center gap-1.5"><Truck size={13} /> {t('checkout.step2')}</p>
                <p className="text-sm font-semibold">
                  {form.building} {form.apartment ? `, ${form.apartment}` : ''}, {form.area} — {emirateName(form.emirate, lang)}
                </p>
                <p className="text-xs text-ink/50">{form.address}{form.landmark ? ` (${form.landmark})` : ''}</p>
              </div>

              <div className="border-2 border-brand-600 bg-brand-50 rounded-xl p-4 flex items-center gap-3">
                <span className="h-11 w-11 rounded-xl bg-brand-700 text-white flex items-center justify-center shrink-0">
                  <Banknote size={20} />
                </span>
                <div>
                  <p className="font-bold text-sm">{t('checkout.codTitle')}</p>
                  <p className="text-xs text-ink/55">{t('checkout.codSub')}</p>
                </div>
                <Check className="ms-auto text-brand-700 shrink-0" size={20} />
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 text-[11px] text-ink/45 font-medium">
                <span>✓ {t('checkout.trust1')}</span>
                <span>✓ {t('checkout.trust2')}</span>
                <span>✓ {t('checkout.trust3')}</span>
              </div>

              <div className="flex gap-3 mt-6">
                <button className="btn-outline !px-6 !py-3" onClick={() => setStep(2)} disabled={placing}>
                  <ChevronLeft size={17} className="rtl:rotate-180" /> {t('checkout.back')}
                </button>
                <button className="btn-primary flex-1 !py-3.5 text-[15px]" onClick={placeOrder} disabled={placing || !totals}>
                  {placing ? <Spinner /> : <Lock size={17} />}
                  {placing ? t('checkout.ordering') : `${t('checkout.placeOrder')} — ${totals ? aed(totals.total) : '…'}`}
                </button>
              </div>
            </section>
          )}
        </div>

        <aside className="card p-5 h-fit lg:sticky lg:top-24">
          <h2 className="font-extrabold text-lg mb-4">{t('checkout.summary')}</h2>
          <div className="grid gap-3 max-h-72 overflow-y-auto pr-1 mb-4">
            {cart.items.map((i) => (
              <div key={`${i.productId}-${i.variantId ?? ''}`} className="flex gap-3">
                <img src={i.image || ''} alt="" className="h-14 w-14 rounded-lg object-cover bg-cream shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold line-clamp-2">{i.title}</p>
                  <p className="text-xs text-ink/45">× {i.quantity}</p>
                </div>
                <span className="text-[13px] font-bold shrink-0">{aed(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-2 text-sm border-t border-ink/8 pt-4">
            <div className="flex justify-between text-ink/60">
              <span>{t('cart.subtotal')} ({itemCount})</span>
              <span className="font-semibold">{aed(subtotal)}</span>
            </div>
            {totals && totals.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>{t('cart.discount')} ({cart.couponCode})</span>
                <span className="font-semibold">-{aed(totals.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-ink/60">
              <span>{t('cart.shipping')}</span>
              {totalsBusy ? (
                <Spinner className="h-4 w-4" />
              ) : totals ? (
                <span className="font-semibold">{totals.shippingFee === 0 ? 'FREE' : aed(totals.shippingFee)}</span>
              ) : (
                <span className="text-ink/35">—</span>
              )}
            </div>
            {totals && totals.codFee > 0 && (
              <div className="flex justify-between text-ink/60">
                <span>{t('cart.codFee')}</span>
                <span className="font-semibold">{aed(totals.codFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-base pt-2 border-t border-ink/8">
              <span>{t('cart.total')}</span>
              <span className="text-brand-800">{totals ? aed(totals.total) : aed(subtotal)}</span>
            </div>
            {totals && (
              <p className="text-[11px] text-ink/45 flex items-center gap-1 mt-1">
                <Truck size={12} /> {t('track.estDelivery', { d: totals.deliveryEstimate })}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label} {error && <span className="text-red-500 normal-case font-bold">• {error}</span>}</label>
      {children}
    </div>
  );
}
