// Static content pages: About, Contact, FAQ, policies, 404.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MessageCircle, Clock, MapPin, Send } from 'lucide-react';
import { api } from '../lib/api';
import { useT, useLang } from '../i18n';
import { useSite, toast } from '../store';
import { useDocumentTitle } from '../hooks';
import { Spinner } from '../components/ui';
import { waLink } from '../lib/format';

// ---------------- About ----------------
export function AboutPage() {
  const t = useT();
  useDocumentTitle('About Us — DesertCart');
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold mb-6">{t('page.about.title')}</h1>
      <div className="grid gap-5 text-ink/65 leading-relaxed text-[15px]">
        <p>
          DesertCart is a Dubai-based online store bringing you hand-picked, high-quality products — from smart
          gadgets and home essentials to beauty and lifestyle favourites.
        </p>
        <p>
          We built DesertCart around one simple promise: <strong className="text-brand-800">shop with zero risk</strong>.
          Every single order is Cash on Delivery — you only pay when your package is in your hands.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card p-5">
            <h2 className="font-bold mb-2">🇦🇪 UAE-wide delivery</h2>
            <p className="text-sm">Fast delivery to Dubai, Abu Dhabi, Sharjah, Ajman, Umm Al Quwain, Ras Al Khaimah and Fujairah.</p>
          </div>
          <div className="card p-5">
            <h2 className="font-bold mb-2">💵 Cash on Delivery</h2>
            <p className="text-sm">No prepayment, no online card required. Pay in cash when your order arrives.</p>
          </div>
          <div className="card p-5">
            <h2 className="font-bold mb-2">🤝 Real support</h2>
            <p className="text-sm">Reach us on WhatsApp or phone — real humans, quick answers, before and after your order.</p>
          </div>
          <div className="card p-5">
            <h2 className="font-bold mb-2">↩️ Easy returns</h2>
            <p className="text-sm">7-day return window on eligible products. We make it simple and fair.</p>
          </div>
        </div>
        <p>
          Questions? <Link to="/contact" className="text-brand-700 font-bold hover:underline">Contact us</Link> — we usually reply within a few hours.
        </p>
      </div>
    </div>
  );
}

// ---------------- Contact ----------------
export function ContactPage() {
  const t = useT();
  const { settings } = useSite();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  useDocumentTitle('Contact Us — DesertCart');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/api/contact', form);
      setSent(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold mb-2">{t('page.contact.title')}</h1>
      <p className="text-ink/55 mb-8">{t('page.contact.sub')}</p>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="grid gap-3 content-start">
          <a className="card p-4 flex items-center gap-3 hover:shadow-lift transition-shadow" href={`tel:${String(settings?.['store.phone'] || '')}`}>
            <span className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center"><Phone size={18} /></span>
            <div><p className="text-xs text-ink/45">{t('misc.phone')}</p><p className="font-bold text-sm" dir="ltr">{settings?.['store.phone'] || '—'}</p></div>
          </a>
          <a className="card p-4 flex items-center gap-3 hover:shadow-lift transition-shadow" href={`mailto:${String(settings?.['store.email'] || '')}`}>
            <span className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center"><Mail size={18} /></span>
            <div><p className="text-xs text-ink/45">{t('misc.email')}</p><p className="font-bold text-sm">{settings?.['store.email'] || '—'}</p></div>
          </a>
          <a className="card p-4 flex items-center gap-3 hover:shadow-lift transition-shadow" href={waLink(String(settings?.['store.whatsapp'] || '971500000000'), 'Hello DesertCart!')} target="_blank" rel="noopener noreferrer">
            <span className="h-10 w-10 rounded-xl bg-[#25D366]/15 text-[#128C4A] flex items-center justify-center"><MessageCircle size={18} /></span>
            <div><p className="text-xs text-ink/45">{t('misc.whatsapp')}</p><p className="font-bold text-sm">Chat with us</p></div>
          </a>
          <div className="card p-4 flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center"><Clock size={18} /></span>
            <div><p className="text-xs text-ink/45">{t('misc.hours')}</p><p className="font-bold text-sm">{settings?.['store.workingHours'] || '—'}</p></div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center"><MapPin size={18} /></span>
            <div><p className="text-xs text-ink/45">{t('misc.address')}</p><p className="font-bold text-sm">{String(settings?.['store.address'] || 'Dubai, UAE')}</p></div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {sent ? (
            <div className="card p-10 text-center">
              <div className="text-5xl mb-4">✅</div>
              <p className="font-bold text-lg">{t('page.contact.sent')}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="card p-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">{t('page.contact.name')}</label>
                <input className="input" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('page.contact.email')}</label>
                <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('page.contact.phone')}</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('page.contact.subject')}</label>
                <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">{t('page.contact.message')}</label>
                <textarea className="input min-h-[130px]" required minLength={5} maxLength={2000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <button className="btn-primary !px-8 !py-3" disabled={busy}>
                  {busy ? <Spinner className="h-4 w-4" /> : <Send size={16} />} {t('page.contact.send')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- FAQ ----------------
export function FaqPage() {
  const t = useT();
  const lang = useLang();
  const [faqs, setFaqs] = useState<{ q: string; a: string; qAr?: string; aAr?: string }[]>([]);
  const [open, setOpen] = useState<number | null>(0);
  useDocumentTitle('FAQ — DesertCart');

  useEffect(() => {
    api
      .get<{ sections: { type: string; config: Record<string, unknown> }[] }>('/api/home')
      .then((d) => {
        const faqSection = d.sections.find((s) => s.type === 'FAQ');
        if (faqSection?.config?.faqs) setFaqs(faqSection.config.faqs as never);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold mb-8">{t('page.faq.title')}</h1>
      <div className="grid gap-3">
        {(faqs.length ? faqs : defaultFaqs).map((f, i) => (
          <div key={i} className="card overflow-hidden">
            <button className="w-full flex items-center justify-between gap-3 p-4 text-start font-semibold text-sm hover:bg-brand-50/40" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              <span>{lang === 'ar' && f.qAr ? f.qAr : f.q}</span>
              <span className={`transition-transform ${open === i ? 'rotate-45' : ''} text-brand-700 shrink-0`}>+</span>
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
  );
}

const defaultFaqs: { q: string; a: string; qAr?: string; aAr?: string }[] = [
  { q: 'Is Cash on Delivery available in my emirate?', a: 'Yes — we deliver with COD to all 7 emirates: Dubai, Abu Dhabi, Sharjah, Ajman, Umm Al Quwain, Ras Al Khaimah and Fujairah.' },
  { q: 'How long does delivery take?', a: 'Dubai orders typically arrive in 1-2 business days. Other emirates take 2-3 business days.' },
  { q: 'Can I return a product?', a: 'Yes — you have 7 days to request a return or exchange. See our Return Policy for details.' },
  { q: 'How do I track my order?', a: 'Use the Track Order page with your order ID and mobile number. You will also receive SMS updates.' },
];

// ---------------- Static policy pages ----------------
const POLICIES: Record<string, { title: string; sections: { h: string; p: string[] }[] }> = {
  shipping: {
    title: 'Shipping Policy',
    sections: [
      { h: 'Delivery coverage', p: ['We deliver to all 7 emirates of the UAE: Dubai, Abu Dhabi, Sharjah, Ajman, Umm Al Quwain, Ras Al Khaimah and Fujairah.'] },
      { h: 'Delivery time', p: ['Dubai: 1-2 business days.', 'Other emirates: 2-3 business days.', 'Orders placed before 3 PM are usually dispatched the same day.'] },
      { h: 'Shipping fees', p: ['Dubai: AED 15 per order.', 'Other emirates: AED 25 per order.', 'Free shipping on orders over AED 199.', 'All orders are Cash on Delivery — no prepayment is required.'] },
      { h: 'Order tracking', p: ['You can track your order anytime using the Track Order page with your order ID and mobile number.'] },
    ],
  },
  returns: {
    title: 'Return Policy',
    sections: [
      { h: '7-day returns', p: ['You have 7 days from delivery to request a return or exchange for eligible products.'] },
      { h: 'Conditions', p: ['The product must be unused, in its original packaging, with all accessories included.', 'Items damaged in transit should be reported within 24 hours of delivery with photos.'] },
      { h: 'How to request', p: ['Contact us on WhatsApp or by phone with your order number.', 'Our team will guide you through the return process and arrange pickup where applicable.', 'Refunds are issued after inspection — for COD orders, refunds are returned to your bank account or issued as store credit.'] },
      { h: 'Non-returnable items', p: ['Personal care items that have been opened, and items marked as final sale.'] },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      { h: 'What we collect', p: ['We collect only what is needed to fulfil your order: your name, UAE mobile number, delivery address, and (optionally) email.'] },
      { h: 'How we use it', p: ['Your information is used to process orders, arrange delivery, provide order updates, and improve our service.', 'We never sell your personal information to third parties.'] },
      { h: 'Cash on Delivery privacy', p: ['For COD orders, limited information (name, phone, address) is shared with our delivery partner solely to deliver your order.'] },
      { h: 'Security', p: ['We use encryption in transit, secure session handling, and access controls. Your password is never stored in plain text.'] },
      { h: 'Your rights', p: ['You may request a copy or deletion of your personal data at any time by contacting us.'] },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    sections: [
      { h: 'Agreement', p: ['By placing an order with DesertCart you agree to these terms and conditions.'] },
      { h: 'Orders & payment', p: ['All orders are processed as Cash on Delivery (COD) unless otherwise stated.', 'Order acceptance is confirmed by our team; we may cancel orders affected by stock issues or pricing errors.'] },
      { h: 'Pricing', p: ['All prices are in UAE Dirhams (AED) and include applicable fees shown at checkout.', 'We reserve the right to change prices at any time without notice; the price at checkout applies to your order.'] },
      { h: 'Product information', p: ['We work hard to keep product descriptions, images and stock accurate, but minor variations may occur.'] },
      { h: 'Limitation of liability', p: ['Our liability is limited to the value of the goods purchased. We are not liable for indirect or consequential losses.'] },
    ],
  },
};

export function StaticPolicyPage({ page }: { page: keyof typeof POLICIES }) {
  const t = useT();
  const policy = POLICIES[page];
  useDocumentTitle(`${policy.title} — DesertCart`);
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold mb-8">{policy.title}</h1>
      <div className="grid gap-6">
        {policy.sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-bold text-lg mb-2">{s.h}</h2>
            {s.p.map((para, i) => (
              <p key={i} className="text-sm text-ink/60 leading-relaxed mb-1.5">{para}</p>
            ))}
          </section>
        ))}
      </div>
      <p className="mt-10 text-sm text-ink/45">
        Questions? <Link to="/contact" className="text-brand-700 font-bold hover:underline">{t('nav.contact')}</Link>
      </p>
    </div>
  );
}

// ---------------- 404 ----------------
export function NotFoundPage() {
  const t = useT();
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <p className="text-7xl font-extrabold text-brand-100 mb-4">404</p>
      <h1 className="text-2xl font-extrabold mb-2">{t('page.notFound.title')}</h1>
      <p className="text-ink/55 mb-8">{t('page.notFound.sub')}</p>
      <Link to="/" className="btn-primary !px-8 !py-3">{t('page.notFound.home')}</Link>
    </div>
  );
}
