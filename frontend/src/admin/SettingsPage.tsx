// Admin settings: grouped editable store settings (public subset + admin).
import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { useToast } from '../store';
import { PageHeader, Field } from './ui';
import { Spinner, Toggle } from '../components/ui';

type Value = string | number | boolean | unknown[] | Record<string, unknown>;

export function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<Record<string, Value> | null>(null);
  const [draft, setDraft] = useState<Record<string, Value>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Record<string, Value>>('/api/admin/settings').then((d) => {
      setSettings(d);
      setDraft(JSON.parse(JSON.stringify(d)));
    }).catch(() => undefined);
  }, []);

  const set = (key: string, v: Value) => setDraft((prev) => ({ ...prev, [key]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(draft).map(([key, value]) => ({ key, value }));
      const res = await api.put<{ saved: string[]; rejected: string[] }>('/api/admin/settings', entries);
      toast.push('success', `Saved ${res.saved.length} settings${res.rejected.length ? ` (${res.rejected.length} rejected)` : ''}`);
    } catch (e) {
      toast.push('error', friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="py-20 text-center text-sm text-ink/40">Loading settings…</div>;

  const Group = ({ title, keys, hint }: { title: string; keys: string[]; hint?: string }) => (
    <section className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
      <h2 className="font-bold text-sm mb-1">{title}</h2>
      {hint && <p className="text-xs text-ink/45 mb-4">{hint}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {keys.map((k) => (
          <SettingInput key={k} k={k} value={draft[k]} onChange={(v) => set(k, v)} />
        ))}
      </div>
    </section>
  );

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Store configuration — changes apply immediately"
        actions={
          <button className="btn-primary !py-2 !px-5 text-sm" onClick={save} disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : <Save size={15} />} Save All
          </button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-5 content-start">
        <Group
          title="Store Identity"
          keys={['store.name', 'store.nameAr', 'store.tagline', 'store.email', 'store.phone', 'store.whatsapp', 'store.address', 'store.workingHours', 'store.logo', 'store.favicon']}
          hint="Shown across the website, invoices and notifications"
        />
        <Group
          title="Shipping & COD"
          keys={['shipping.freeShippingThreshold', 'shipping.minOrderAmount', 'shipping.deliveryEstimateDays', 'shipping.codAvailable', 'orders.prefix', 'orders.autoConfirm']}
          hint="Per-emirate delivery fees are managed in Shipping zones; these are global rules"
        />
        <Group title="Announcement Bar" keys={['announcement.enabled', 'announcement.text', 'announcement.textAr', 'announcement.link']} />
        <Group title="Popups & Social Proof" keys={[
          'popups.salesEnabled', 'popups.salesIntervalSec', 'popups.salesDurationMs', 'popups.salesMaxPerDay', 'popups.salesMaskNames',
          'popups.discountEnabled', 'popups.discountTitle', 'popups.discountTitleAr', 'popups.discountCode', 'popups.discountDelaySec', 'popups.discountFrequencyDays', 'popups.exitIntentEnabled',
          'popups.newsletterEnabled', 'popups.newsletterDelaySec', 'popups.newsletterFrequencyDays',
        ]}
          hint="Sales popups only ever show REAL orders (masked). In DEMO_MODE they are labelled demo." />
        <Group title="SEO" keys={['seo.title', 'seo.titleAr', 'seo.description', 'seo.descriptionAr', 'seo.keywords', 'seo.ogImage']} />
        <Group title="Social & Footer" keys={['social.instagram', 'social.tiktok', 'social.facebook', 'social.youtube', 'social.twitter', 'footer.aboutText', 'footer.aboutTextAr', 'footer.copyright']} />
        <Group title="Checkout" keys={['checkout.emailRequired', 'checkout.notesEnabled', 'theme.primaryColor', 'theme.accentColor']} />
        <Group
          title="Analytics & Notifications"
          keys={['analytics.gaId', 'analytics.metaPixelId', 'analytics.tiktokPixelId', 'notifications.soundEnabled', 'notifications.adminNewOrderEnabled', 'notifications.lowStockEnabled']}
          hint="Pixel IDs are injected into the storefront automatically — page views, ViewContent and AddToCart events are tracked (public-safe)"
        />
        <Group title="Fraud Detection" keys={['fraud.duplicateWindowHours', 'fraud.duplicateMaxOrders', 'fraud.flagHighValueOrdersAbove']} hint="Duplicate COD orders from the same phone are flagged — never auto-rejected" />
        <Group title="Maintenance" keys={['maintenance.enabled', 'maintenance.message']} />
      </div>
    </div>
  );
}

const LABEL_OVERRIDES: Record<string, string> = {
  'analytics.gaId': 'Google Analytics (GA4) ID',
  'analytics.metaPixelId': 'Meta Pixel (Facebook) ID',
  'analytics.tiktokPixelId': 'TikTok Pixel ID',
};

function SettingInput({ k, value, onChange }: { k: string; value: Value; onChange: (v: Value) => void }) {
  const label =
    LABEL_OVERRIDES[k] ||
    k.split('.').slice(1).join('.').replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

  if (typeof value === 'boolean') {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <Toggle checked={value} onChange={onChange} label={label} />
      </div>
    );
  }
  if (typeof value === 'number') {
    return (
      <Field label={label}>
        <input className="input" type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </Field>
    );
  }
  if (Array.isArray(value)) {
    return (
      <Field label={label} hint="JSON array — edit with care">
        <textarea className="input font-mono text-xs min-h-[70px]" value={JSON.stringify(value, null, 1)} onChange={(e) => { try { onChange(JSON.parse(e.target.value)); } catch { /* invalid */ } }} />
      </Field>
    );
  }
  if (typeof value === 'object' && value !== null) {
    return (
      <Field label={label} hint="JSON object — edit with care">
        <textarea className="input font-mono text-xs min-h-[70px]" value={JSON.stringify(value, null, 1)} onChange={(e) => { try { onChange(JSON.parse(e.target.value)); } catch { /* invalid */ } }} />
      </Field>
    );
  }
  return (
    <Field label={label}>
      <input
        className="input"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        dir={/^(store\.whatsapp|store\.phone|orders\.prefix|analytics\.|seo\.|social\.)/.test(k) ? 'ltr' : undefined}
      />
    </Field>
  );
}
