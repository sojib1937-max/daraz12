// Homepage builder: enable/disable, reorder, edit section content.
import React, { useEffect, useState } from 'react';
import { GripVertical, Pencil, Eye, EyeOff, Plus, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { useToast } from '../store';
import { PageHeader, Field, ConfirmDialog } from './ui';
import { Badge, Modal, Spinner } from '../components/ui';

interface Section {
  id: number; type: string; title: string | null; titleAr: string | null;
  subtitle: string | null; subtitleAr: string | null; config: Record<string, unknown>;
  sortOrder: number; isEnabled: boolean;
}

const SECTION_META: Record<string, { label: string; desc: string }> = {
  HERO: { label: 'Hero Banner', desc: 'Large banner with headline, CTA and optional countdown' },
  CATEGORIES: { label: 'Category Cards', desc: 'Grid of category cards' },
  FEATURED: { label: 'Featured Products', desc: 'Products flagged as featured' },
  BEST_SELLERS: { label: 'Best Sellers', desc: 'Products flagged as best sellers' },
  FLASH_SALE: { label: 'Flash Sale', desc: 'Active flash sale with countdown' },
  TRUST_BADGES: { label: 'Trust Badges', desc: 'COD, delivery, support, returns' },
  COD_BANNER: { label: 'COD Banner', desc: 'Cash on Delivery highlight banner' },
  SOCIAL_PROOF: { label: 'Recently Sold Strip', desc: 'Social proof banner' },
  RECOMMENDED: { label: 'Recommended Products', desc: 'Products flagged as recommended' },
  REVIEWS: { label: 'Customer Reviews', desc: 'Featured approved reviews' },
  FAQ: { label: 'FAQ', desc: 'Collapsible questions' },
  NEWSLETTER: { label: 'Newsletter', desc: 'Email subscribe block' },
  PROMO_BANNER: { label: 'Promo Banner', desc: 'Custom banner' },
};

export function Homepage() {
  const toast = useToast();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Section | null>(null);
  const [confirm, setConfirm] = useState<{ id: number; type: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<Section[]>('/api/admin/homepage').then((d) => setSections(d.sort((a, b) => a.sortOrder - b.sortOrder))).catch(() => undefined).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggle = async (s: Section) => {
    try {
      await api.patch(`/api/admin/homepage/${s.id}`, { isEnabled: !s.isEnabled });
      load();
    } catch (e) {
      toast.push('error', friendlyError(e));
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...sections];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    const reordered = next.map((s, i) => ({ id: s.id, sortOrder: i + 1 }));
    setSections(next);
    try {
      await api.put('/api/admin/homepage/reorder', reordered);
    } catch {
      load();
    }
  };

  const addSection = async () => {
    const type = window.prompt('Section type (HERO, CATEGORIES, FEATURED, BEST_SELLERS, FLASH_SALE, TRUST_BADGES, COD_BANNER, SOCIAL_PROOF, RECOMMENDED, REVIEWS, FAQ, NEWSLETTER, PROMO_BANNER)')?.trim().toUpperCase();
    if (!type || !SECTION_META[type]) return;
    try {
      await api.post('/api/admin/homepage', { type, sortOrder: sections.length + 1, isEnabled: true });
      load();
    } catch (e) {
      toast.push('error', friendlyError(e));
    }
  };

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    try {
      await api.patch(`/api/admin/homepage/${editor.id}`, editor);
      toast.push('success', 'Section saved');
      setEditor(null);
      load();
    } catch (e) {
      toast.push('error', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await api.del(`/api/admin/homepage/${confirm.id}`);
      setConfirm(null);
      load();
    } catch (e) {
      toast.push('error', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Homepage Builder"
        subtitle="Control what appears on the storefront home page — no code needed"
        actions={
          <button className="btn-primary !py-2 !px-4 text-sm" onClick={addSection}>
            <Plus size={15} /> Add section
          </button>
        }
      />

      {loading ? (
        <div className="h-40 skeleton rounded-2xl" />
      ) : (
        <div className="grid gap-2.5 max-w-2xl">
          {sections.map((s, idx) => (
            <div key={s.id} className={`bg-white rounded-2xl border shadow-card p-4 flex items-center gap-3 ${s.isEnabled ? 'border-ink/5' : 'border-dashed border-ink/15 opacity-60'}`}>
              <GripVertical size={17} className="text-ink/25 cursor-grab" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm">{SECTION_META[s.type]?.label || s.type}</p>
                  {s.isEnabled ? <Badge color="green">Visible</Badge> : <Badge color="gray">Hidden</Badge>}
                </div>
                <p className="text-[11px] text-ink/45 truncate">{SECTION_META[s.type]?.desc || ''}{s.title ? ` — ${s.title}` : ''}</p>
              </div>
              <div className="flex items-center gap-0.5">
                <button className="p-1.5 rounded-lg hover:bg-ink/5 text-ink/50 disabled:opacity-20" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move up"><ChevronUp size={15} /></button>
                <button className="p-1.5 rounded-lg hover:bg-ink/5 text-ink/50 disabled:opacity-20" onClick={() => move(idx, 1)} disabled={idx === sections.length - 1} aria-label="Move down"><ChevronDown size={15} /></button>
                <button className="p-1.5 rounded-lg hover:bg-brand-50 text-ink/50" onClick={() => setEditor({ ...s })} aria-label="Edit"><Pencil size={15} /></button>
                <button className="p-1.5 rounded-lg hover:bg-ink/5 text-ink/50" onClick={() => toggle(s)} aria-label="Toggle visibility">{s.isEnabled ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                <button className="p-1.5 rounded-lg hover:bg-red-50 text-ink/50 hover:text-red-600" onClick={() => setConfirm({ id: s.id, type: s.type })} aria-label="Delete"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editor} onClose={() => setEditor(null)} title={`Edit ${editor ? SECTION_META[editor.type]?.label : ''}`} wide>
        {editor && (
          <div className="grid gap-4">
            {editor.type !== 'HERO' && (
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Title (English)">
                  <input className="input" value={editor.title || ''} onChange={(e) => setEditor({ ...editor, title: e.target.value })} />
                </Field>
                <Field label="Title (Arabic)">
                  <input className="input" value={editor.titleAr || ''} onChange={(e) => setEditor({ ...editor, titleAr: e.target.value })} dir="rtl" />
                </Field>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Subtitle (English)">
                <input className="input" value={editor.subtitle || ''} onChange={(e) => setEditor({ ...editor, subtitle: e.target.value })} />
              </Field>
              <Field label="Subtitle (Arabic)">
                <input className="input" value={editor.subtitleAr || ''} onChange={(e) => setEditor({ ...editor, subtitleAr: e.target.value })} dir="rtl" />
              </Field>
            </div>

            {editor.type === 'HERO' && (
              <div className="bg-cream rounded-xl p-4 grid gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-ink/45">Hero configuration</p>
                <Field label="Background image URL">
                  <input className="input" value={String(editor.config.image || '')} onChange={(e) => setEditor({ ...editor, config: { ...editor.config, image: e.target.value } })} dir="ltr" />
                </Field>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Discount badge (e.g. -40%)">
                    <input className="input" value={String(editor.config.discountBadge || '')} onChange={(e) => setEditor({ ...editor, config: { ...editor.config, discountBadge: e.target.value } })} />
                  </Field>
                  <Field label="CTA link">
                    <input className="input" value={String(editor.config.ctaLink || '/shop')} onChange={(e) => setEditor({ ...editor, config: { ...editor.config, ctaLink: e.target.value } })} dir="ltr" />
                  </Field>
                  <Field label="CTA text (English)">
                    <input className="input" value={String(editor.config.ctaText || 'Shop Now')} onChange={(e) => setEditor({ ...editor, config: { ...editor.config, ctaText: e.target.value } })} />
                  </Field>
                  <Field label="CTA text (Arabic)">
                    <input className="input" value={String(editor.config.ctaTextAr || 'تسوق الآن')} onChange={(e) => setEditor({ ...editor, config: { ...editor.config, ctaTextAr: e.target.value } })} dir="rtl" />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input type="checkbox" className="accent-brand-700" checked={!!editor.config.countdownEnabled} onChange={(e) => setEditor({ ...editor, config: { ...editor.config, countdownEnabled: e.target.checked } })} />
                  Show countdown
                </label>
                {!!editor.config.countdownEnabled && (
                  <Field label="Countdown ends at (ISO)">
                    <input className="input" value={String(editor.config.countdownEndsAt || '')} onChange={(e) => setEditor({ ...editor, config: { ...editor.config, countdownEndsAt: e.target.value } })} dir="ltr" placeholder="2026-12-31T23:59:59" />
                  </Field>
                )}
              </div>
            )}

            {editor.type === 'FAQ' && (
              <div className="grid gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-ink/45">Questions & answers</p>
                {(editor.config.faqs as { q: string; a: string; qAr?: string; aAr?: string }[] | undefined)?.map((f, i) => (
                  <div key={i} className="border border-ink/8 rounded-xl p-3 grid gap-2">
                    <input className="input !py-2 text-sm" placeholder="Question (EN)" value={f.q} onChange={(e) => setEditor({ ...editor, config: { ...editor.config, faqs: ((editor.config.faqs as Record<string, unknown>[]) || []).map((x, xi) => (xi === i ? { ...x, q: e.target.value } : x)) } })} />
                    <textarea className="input !py-2 text-sm min-h-[60px]" placeholder="Answer (EN)" value={f.a} onChange={(e) => setEditor({ ...editor, config: { ...editor.config, faqs: ((editor.config.faqs as Record<string, unknown>[]) || []).map((x, xi) => (xi === i ? { ...x, a: e.target.value } : x)) } })} />
                    <input className="input !py-2 text-sm" placeholder="Question (AR)" dir="rtl" value={f.qAr || ''} onChange={(e) => setEditor({ ...editor, config: { ...editor.config, faqs: ((editor.config.faqs as Record<string, unknown>[]) || []).map((x, xi) => (xi === i ? { ...x, qAr: e.target.value } : x)) } })} />
                    <textarea className="input !py-2 text-sm min-h-[60px]" placeholder="Answer (AR)" dir="rtl" value={f.aAr || ''} onChange={(e) => setEditor({ ...editor, config: { ...editor.config, faqs: ((editor.config.faqs as Record<string, unknown>[]) || []).map((x, xi) => (xi === i ? { ...x, aAr: e.target.value } : x)) } })} />
                    <button className="text-xs font-bold text-red-500 justify-self-start" onClick={() => setEditor({ ...editor, config: { ...editor.config, faqs: ((editor.config.faqs as Record<string, unknown>[]) || []).filter((_, xi) => xi !== i) } })}>Remove</button>
                  </div>
                ))}
                <button className="btn-outline !py-2 text-sm justify-self-start" onClick={() => setEditor({ ...editor, config: { ...editor.config, faqs: [...((editor.config.faqs as Record<string, unknown>[]) || []), { q: '', a: '' }] } })}>
                  <Plus size={14} /> Add question
                </button>
              </div>
            )}

            <button className="btn-primary !py-2.5" onClick={save} disabled={busy}>
              {busy && <Spinner className="h-4 w-4" />} Save section
            </button>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={del} busy={busy} title="Delete section" message={`Delete this ${confirm ? SECTION_META[confirm.type]?.label : ''} section from the homepage?`} />
    </div>
  );
}
