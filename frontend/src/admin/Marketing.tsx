// Admin coupons + flash sales.
import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { useToast } from '../store';
import { PageHeader, ConfirmDialog, Field, EmptyRow, AdminPagination } from './ui';
import { Badge, Modal, Spinner } from '../components/ui';
import { formatDate } from '../lib/format';

interface Coupon {
  id: number; code: string; type: string; value: number; minOrderAmount: number | null; maxDiscount: number | null;
  startsAt: string | null; expiresAt: string | null; usageLimit: number | null; perCustomerLimit: number;
  usageCount: number; isActive: boolean;
  products: { id: number; title: string }[]; categories: { id: number; name: string }[];
}

const EMPTY_COUPON = {
  code: '', type: 'PERCENTAGE', value: 10, minOrderAmount: '', maxDiscount: '', startsAt: '', expiresAt: '',
  usageLimit: '', perCustomerLimit: 1, isActive: true, productIds: [] as number[], categoryIds: [] as number[],
};

export function Coupons() {
  const toast = useToast();
  const [items, setItems] = useState<Coupon[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState<{ id?: number } & typeof EMPTY_COUPON | null>(null);
  const [confirm, setConfirm] = useState<{ id: number; code: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = (page = 1) => {
    setLoading(true);
    api
      .get<{ items: Coupon[]; pagination: typeof pagination }>(`/api/admin/coupons?page=${page}&q=${encodeURIComponent(q)}`)
      .then((d) => {
        setItems(d.items);
        setPagination(d.pagination);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const openEdit = (c?: Coupon) => {
    if (!c) return setEditor({ ...EMPTY_COUPON });
    setEditor({
      id: c.id, code: c.code, type: c.type, value: Number(c.value),
      minOrderAmount: c.minOrderAmount != null ? String(c.minOrderAmount) : '',
      maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : '',
      startsAt: c.startsAt ? c.startsAt.slice(0, 16) : '', expiresAt: c.expiresAt ? c.expiresAt.slice(0, 16) : '',
      usageLimit: c.usageLimit != null ? String(c.usageLimit) : '', perCustomerLimit: c.perCustomerLimit, isActive: c.isActive,
      productIds: c.products.map((p) => p.id), categoryIds: c.categories.map((x) => x.id),
    });
  };

  const save = async () => {
    if (!editor || !editor.code.trim()) return;
    setBusy(true);
    const payload = {
      ...editor,
      value: Number(editor.value) || 0,
      minOrderAmount: editor.minOrderAmount ? Number(editor.minOrderAmount) : null,
      maxDiscount: editor.maxDiscount ? Number(editor.maxDiscount) : null,
      startsAt: editor.startsAt ? new Date(editor.startsAt).toISOString() : null,
      expiresAt: editor.expiresAt ? new Date(editor.expiresAt).toISOString() : null,
      usageLimit: editor.usageLimit ? Number(editor.usageLimit) : null,
    };
    try {
      if (editor.id) {
        await api.patch(`/api/admin/coupons/${editor.id}`, payload);
        toast.push('success', 'Coupon updated');
      } else {
        await api.post('/api/admin/coupons', payload);
        toast.push('success', 'Coupon created');
      }
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
      await api.del(`/api/admin/coupons/${confirm.id}`);
      toast.push('success', 'Coupon deleted');
      setConfirm(null);
      load();
    } catch (e) {
      toast.push('error', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const expired = (c: Coupon) => c.expiresAt && new Date(c.expiresAt) < new Date();

  return (
    <div>
      <PageHeader
        title="Coupons"
        subtitle={`${pagination.total} coupons`}
        actions={
          <button className="btn-primary !py-2 !px-4 text-sm" onClick={() => openEdit()}>
            <Plus size={15} /> New Coupon
          </button>
        }
      />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search coupon code…" className="input !w-64 mb-4" aria-label="Search coupons" />

      <div className="bg-white rounded-2xl border border-ink/5 shadow-card overflow-x-auto">
        <table className="table-base min-w-[820px]">
          <thead>
            <tr><th>Code</th><th>Type</th><th>Value</th><th>Min order</th><th>Usage</th><th>Valid until</th><th>Status</th><th className="!text-end">Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <EmptyRow colSpan={8} message="Loading…" />
            ) : (
              items.map((c) => (
                <tr key={c.id}>
                  <td className="font-extrabold text-brand-800 tracking-wide" dir="ltr">{c.code}</td>
                  <td><Badge color={c.type === 'PERCENTAGE' ? 'blue' : c.type === 'FIXED' ? 'violet' : 'green'}>{c.type}</Badge></td>
                  <td className="font-bold">{c.type === 'PERCENTAGE' ? `${Number(c.value)}%` : `AED ${Number(c.value)}`}</td>
                  <td className="text-ink/55">{c.minOrderAmount != null ? `AED ${Number(c.minOrderAmount)}` : '—'}</td>
                  <td className="text-ink/55">{c.usageCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                  <td className="text-[12px] text-ink/50">{c.expiresAt ? formatDate(c.expiresAt) : 'Never'}</td>
                  <td>
                    {expired(c) ? <Badge color="gray">Expired</Badge> : <Badge color={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'Active' : 'Off'}</Badge>}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button className="p-2 rounded-lg hover:bg-brand-50 text-ink/55" onClick={() => openEdit(c)} aria-label="Edit"><Pencil size={14} /></button>
                      <button className="p-2 rounded-lg hover:bg-red-50 text-ink/55 hover:text-red-600" onClick={() => setConfirm({ id: c.id, code: c.code })} aria-label="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <AdminPagination page={pagination.page} pages={pagination.pages} onChange={(p) => { load(p); window.scrollTo({ top: 0 }); }} />

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor?.id ? 'Edit coupon' : 'New coupon'}>
        {editor && (
          <div className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Code" required>
                <input className="input uppercase" value={editor.code} onChange={(e) => setEditor({ ...editor, code: e.target.value.toUpperCase() })} dir="ltr" placeholder="SUMMER20" />
              </Field>
              <Field label="Type">
                <select className="input" value={editor.type} onChange={(e) => setEditor({ ...editor, type: e.target.value })}>
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed (AED)</option>
                  <option value="FREE_SHIPPING">Free shipping</option>
                </select>
              </Field>
              <Field label={editor.type === 'PERCENTAGE' ? 'Value (%)' : editor.type === 'FIXED' ? 'Value (AED)' : 'Value'}>
                <input className="input" type="number" min="0" value={editor.value} onChange={(e) => setEditor({ ...editor, value: Number(e.target.value) })} />
              </Field>
              <Field label="Min order amount (AED)">
                <input className="input" type="number" min="0" value={editor.minOrderAmount} onChange={(e) => setEditor({ ...editor, minOrderAmount: e.target.value })} placeholder="Optional" />
              </Field>
              <Field label="Max discount (AED)">
                <input className="input" type="number" min="0" value={editor.maxDiscount} onChange={(e) => setEditor({ ...editor, maxDiscount: e.target.value })} placeholder="Optional" />
              </Field>
              <Field label="Usage limit">
                <input className="input" type="number" min="1" value={editor.usageLimit} onChange={(e) => setEditor({ ...editor, usageLimit: e.target.value })} placeholder="Unlimited" />
              </Field>
              <Field label="Per-customer limit">
                <input className="input" type="number" min="1" value={editor.perCustomerLimit} onChange={(e) => setEditor({ ...editor, perCustomerLimit: Number(e.target.value) })} />
              </Field>
              <Field label="Starts">
                <input className="input" type="datetime-local" value={editor.startsAt} onChange={(e) => setEditor({ ...editor, startsAt: e.target.value })} />
              </Field>
              <Field label="Expires">
                <input className="input" type="datetime-local" value={editor.expiresAt} onChange={(e) => setEditor({ ...editor, expiresAt: e.target.value })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input type="checkbox" className="accent-brand-700" checked={editor.isActive} onChange={(e) => setEditor({ ...editor, isActive: e.target.checked })} />
              Active
            </label>
            <button className="btn-primary !py-2.5" onClick={save} disabled={busy || !editor.code.trim()}>
              {busy && <Spinner className="h-4 w-4" />} Save coupon
            </button>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={del} busy={busy} title="Delete coupon" message={`Delete coupon "${confirm?.code}"? Customers will no longer be able to use it.`} />
    </div>
  );
}

// ================= Flash sales =================
interface FlashSaleRow {
  id: number; title: string; titleAr: string | null; bannerUrl: string | null;
  startsAt: string; endsAt: string; isActive: boolean; isRunning: boolean;
  items: { productId: number; salePrice: number; stockLimit: number | null; soldCount: number; product: { id: number; title: string; price: number; images: { url: string }[] } }[];
}

export function FlashSales() {
  const toast = useToast();
  const [items, setItems] = useState<FlashSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{ id?: number; title: string; titleAr: string; startsAt: string; endsAt: string; isActive: boolean; items: { productId: string; salePrice: string; stockLimit: string }[] } | null>(null);
  const [confirm, setConfirm] = useState<{ id: number; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<{ id: number; title: string; price: number }[]>([]);

  const load = () => {
    setLoading(true);
    api.get<FlashSaleRow[]>('/api/admin/flash-sales').then(setItems).catch(() => undefined).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const loadProducts = () => {
    api
      .get<{ items: { id: number; title: string; price: number }[] }>('/api/admin/products?limit=100&status=PUBLISHED')
      .then((d) => setProducts(d.items))
      .catch(() => undefined);
  };

  const openNew = () => {
    loadProducts();
    const start = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
    const end = new Date(Date.now() + 12 * 3600000).toISOString().slice(0, 16);
    setEditor({ title: '', titleAr: '', startsAt: start, endsAt: end, isActive: true, items: [{ productId: '', salePrice: '', stockLimit: '' }] });
  };

  const openEdit = (s: FlashSaleRow) => {
    loadProducts();
    setEditor({
      id: s.id, title: s.title, titleAr: s.titleAr || '', startsAt: s.startsAt.slice(0, 16), endsAt: s.endsAt.slice(0, 16), isActive: s.isActive,
      items: s.items.map((i) => ({ productId: String(i.productId), salePrice: String(i.salePrice), stockLimit: i.stockLimit != null ? String(i.stockLimit) : '' })),
    });
  };

  const save = async () => {
    if (!editor || !editor.title.trim() || !editor.items[0]?.productId) return;
    setBusy(true);
    const payload = {
      title: editor.title, titleAr: editor.titleAr || undefined,
      startsAt: new Date(editor.startsAt).toISOString(), endsAt: new Date(editor.endsAt).toISOString(),
      isActive: editor.isActive,
      items: editor.items
        .filter((i) => i.productId && i.salePrice)
        .map((i) => ({ productId: Number(i.productId), salePrice: Number(i.salePrice), stockLimit: i.stockLimit ? Number(i.stockLimit) : null })),
    };
    try {
      if (editor.id) await api.patch(`/api/admin/flash-sales/${editor.id}`, payload);
      else await api.post('/api/admin/flash-sales', payload);
      toast.push('success', editor.id ? 'Flash sale updated' : 'Flash sale created');
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
      await api.del(`/api/admin/flash-sales/${confirm.id}`);
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
        title="Flash Sales"
        subtitle="Time-limited deals with countdown on the storefront"
        actions={
          <button className="btn-primary !py-2 !px-4 text-sm" onClick={openNew}>
            <Plus size={15} /> New Flash Sale
          </button>
        }
      />

      <div className="grid gap-4">
        {loading ? (
          <div className="h-32 skeleton rounded-2xl" />
        ) : items.length === 0 ? (
          <p className="text-sm text-ink/40 text-center py-12">No flash sales yet</p>
        ) : (
          items.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-extrabold">{s.title}</p>
                  <p className="text-xs text-ink/45 mt-0.5">
                    {formatDate(s.startsAt, { withTime: true })} → {formatDate(s.endsAt, { withTime: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {s.isRunning && <Badge color="red">● LIVE NOW</Badge>}
                  <Badge color={s.isActive ? 'green' : 'gray'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                  <button className="p-2 rounded-lg hover:bg-brand-50 text-ink/55" onClick={() => openEdit(s)} aria-label="Edit"><Pencil size={15} /></button>
                  <button className="p-2 rounded-lg hover:bg-red-50 text-ink/55 hover:text-red-600" onClick={() => setConfirm({ id: s.id, title: s.title })} aria-label="Delete"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-4">
                {s.items.map((i) => (
                  <div key={i.productId} className="border border-ink/8 rounded-xl p-2.5 flex gap-2.5 items-center">
                    {i.product.images[0] ? <img src={i.product.images[0].url} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="h-10 w-10 rounded-lg bg-cream" />}
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold truncate">{i.product.title}</p>
                      <p className="text-[11px] text-ink/45">AED {Number(i.salePrice)} (was {Number(i.product.price)}) • sold {i.soldCount}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor?.id ? 'Edit flash sale' : 'New flash sale'} wide>
        {editor && (
          <div className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Title" required>
                <input className="input" value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} />
              </Field>
              <Field label="Title (Arabic)">
                <input className="input" value={editor.titleAr} onChange={(e) => setEditor({ ...editor, titleAr: e.target.value })} dir="rtl" />
              </Field>
              <Field label="Start" required>
                <input className="input" type="datetime-local" value={editor.startsAt} onChange={(e) => setEditor({ ...editor, startsAt: e.target.value })} />
              </Field>
              <Field label="End" required>
                <input className="input" type="datetime-local" value={editor.endsAt} onChange={(e) => setEditor({ ...editor, endsAt: e.target.value })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input type="checkbox" className="accent-brand-700" checked={editor.isActive} onChange={(e) => setEditor({ ...editor, isActive: e.target.checked })} />
              Active
            </label>
            <div>
              <p className="label">Products & sale prices</p>
              <div className="grid gap-2">
                {editor.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_110px_110px_auto] gap-2 items-center">
                    <select className="input !py-2 text-sm" value={item.productId} onChange={(e) => setEditor({ ...editor, items: editor.items.map((x, xi) => (xi === i ? { ...x, productId: e.target.value } : x)) })}>
                      <option value="">Select product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.title} (AED {p.price})</option>
                      ))}
                    </select>
                    <input className="input !py-2 text-sm" type="number" placeholder="Sale price" value={item.salePrice} onChange={(e) => setEditor({ ...editor, items: editor.items.map((x, xi) => (xi === i ? { ...x, salePrice: e.target.value } : x)) })} />
                    <input className="input !py-2 text-sm" type="number" placeholder="Stock limit" value={item.stockLimit} onChange={(e) => setEditor({ ...editor, items: editor.items.map((x, xi) => (xi === i ? { ...x, stockLimit: e.target.value } : x)) })} />
                    <button className="p-2 text-red-500" onClick={() => setEditor({ ...editor, items: editor.items.filter((_, xi) => xi !== i) })} aria-label="Remove"><Trash2 size={15} /></button>
                  </div>
                ))}
                <button className="btn-outline !py-2 text-sm justify-self-start" onClick={() => setEditor({ ...editor, items: [...editor.items, { productId: '', salePrice: '', stockLimit: '' }] })}>
                  <Plus size={15} /> Add product
                </button>
              </div>
            </div>
            <button className="btn-primary !py-2.5" onClick={save} disabled={busy}>
              {busy && <Spinner className="h-4 w-4" />} Save flash sale
            </button>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={del} busy={busy} title="Delete flash sale" message={`Delete "${confirm?.title}"?`} />
    </div>
  );
}
