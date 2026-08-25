// Admin products: list (search/filter/sort/bulk) + create/edit form.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Copy, Upload, Download, Package } from 'lucide-react';
import { api, downloadExport, friendlyError } from '../lib/api';
import { useToast } from '../store';
import { PageHeader, AdminPagination, SearchBox, FilterSelect, ConfirmDialog, Field, EmptyRow } from './ui';
import { Badge, Modal, Spinner } from '../components/ui';
import { aed, formatDate } from '../lib/format';
import type { Product } from '../lib/types';

interface ProductRow {
  id: number; title: string; sku: string; price: number; compareAtPrice: number | null;
  stock: number; lowStockThreshold: number; status: string; isFeatured: boolean; isBestSeller: boolean;
  isRecommended: boolean; soldCount: number; thumbnail: string;
  category: { id: number; name: string } | null; brand: { id: number; name: string } | null;
  orderCount: number; variantCount: number; createdAt: string; updatedAt: string;
}

const STATUS_OPTS = [
  { v: 'ALL', l: 'All statuses' },
  { v: 'PUBLISHED', l: 'Published' },
  { v: 'DRAFT', l: 'Draft' },
  { v: 'ARCHIVED', l: 'Archived' },
];
const STOCK_OPTS = [
  { v: 'all', l: 'All stock' },
  { v: 'low', l: 'Low stock' },
  { v: 'out', l: 'Out of stock' },
];

export function Products() {
  const toast = useToast();
  const [items, setItems] = useState<ProductRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [stock, setStock] = useState('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [confirm, setConfirm] = useState<{ id: number | null; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const load = (page = 1) => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '20', status, stock });
    if (q) qs.set('q', q);
    api
      .get<{ items: ProductRow[]; pagination: typeof pagination }>(`/api/admin/products?${qs}`)
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
  }, [q, status, stock]);

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const runBulk = async () => {
    if (!bulkAction || selected.size === 0) return;
    try {
      await api.post('/api/admin/products/bulk', { ids: [...selected], action: bulkAction });
      toast.push('success', `${bulkAction} applied to ${selected.size} products`);
      setSelected(new Set());
      setBulkAction('');
      load(pagination.page);
    } catch (e) {
      toast.push('error', friendlyError(e));
    }
  };

  const del = async () => {
    if (!confirm?.id) return;
    setDeleting(true);
    try {
      await api.del(`/api/admin/products/${confirm.id}`);
      toast.push('success', 'Product deleted');
      setConfirm(null);
      load(pagination.page);
    } catch (e) {
      toast.push('error', friendlyError(e));
    } finally {
      setDeleting(false);
    }
  };

  const duplicate = async (id: number) => {
    try {
      const res = await api.post<{ id: number }>(`/api/admin/products/${id}/duplicate`);
      toast.push('success', 'Product duplicated (draft)');
      window.location.href = `/admin/products/${res.id}/edit`;
    } catch (e) {
      toast.push('error', friendlyError(e));
    }
  };

  const doImport = async () => {
    if (!csvText.trim()) return;
    setImportBusy(true);
    try {
      const res = await api.post<{ created: number; updated: number; errors: string[] }>('/api/admin/products/import', { csv: csvText });
      setImportResult(res);
    } catch (e) {
      toast.push('error', friendlyError(e));
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${pagination.total} products`}
        actions={
          <>
            <button className="btn-outline !py-2 !px-3.5 text-sm" onClick={() => downloadExport('/api/admin/products/export', `products-${new Date().toISOString().slice(0, 10)}.csv`)}>
              <Download size={15} /> Export
            </button>
            <button className="btn-outline !py-2 !px-3.5 text-sm" onClick={() => setImportOpen(true)}>
              <Upload size={15} /> Import
            </button>
            <button className="btn-outline !py-2 !px-3.5 text-sm" onClick={() => downloadExport('/api/admin/products/import-template', 'product-import-template.csv')}>
              Template
            </button>
            <Link to="/admin/products/new" className="btn-primary !py-2 !px-4 text-sm">
              <Plus size={16} /> Add Product
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search title, SKU, slug…" />
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTS} label="Status" />
        <FilterSelect value={stock} onChange={setStock} options={STOCK_OPTS} label="Stock" />
        {selected.size > 0 && (
          <div className="flex items-center gap-2 ms-auto">
            <span className="text-xs font-bold text-ink/50">{selected.size} selected</span>
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="input !w-auto !py-2 text-sm" aria-label="Bulk action">
              <option value="">Bulk action…</option>
              <option value="PUBLISH">Publish</option>
              <option value="UNPUBLISH">Unpublish</option>
              <option value="DELETE">Delete</option>
            </select>
            <button className="btn-primary !py-2 !px-3 text-sm" onClick={runBulk} disabled={!bulkAction}>
              Apply
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-ink/5 shadow-card overflow-x-auto">
        <table className="table-base min-w-[900px]">
          <thead>
            <tr>
              <th className="!w-10"><input type="checkbox" className="accent-brand-700" aria-label="Select all" checked={selected.size === items.length && items.length > 0} onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())} /></th>
              <th>Product</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Flags</th>
              <th>Sales</th>
              <th>Updated</th>
              <th className="!text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <EmptyRow colSpan={9} message="Loading…" />
            ) : items.length === 0 ? (
              <EmptyRow colSpan={9} message="No products found" />
            ) : (
              items.map((p) => (
                <tr key={p.id}>
                  <td><input type="checkbox" className="accent-brand-700" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} aria-label={`Select ${p.title}`} /></td>
                  <td>
                    <div className="flex items-center gap-3 min-w-[220px]">
                      {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-11 w-11 rounded-lg object-cover bg-cream shrink-0" /> : <span className="h-11 w-11 rounded-lg bg-cream shrink-0 flex items-center justify-center text-ink/25"><Package size={18} /></span>}
                      <div className="min-w-0">
                        <Link to={`/admin/products/${p.id}/edit`} className="text-[13px] font-bold hover:text-brand-700 line-clamp-1">{p.title}</Link>
                        <p className="text-[11px] text-ink/40">{p.sku}{p.category ? ` • ${p.category.name}` : ''}{p.variantCount ? ` • ${p.variantCount} variants` : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="font-bold">{aed(p.price, { compact: true })}</p>
                    {p.compareAtPrice && <p className="text-[11px] text-ink/35 line-through">{aed(p.compareAtPrice, { compact: true })}</p>}
                  </td>
                  <td>
                    <span className={`font-bold ${p.stock === 0 ? 'text-red-500' : p.stock <= p.lowStockThreshold ? 'text-orange-500' : 'text-ink'}`}>{p.stock}</span>
                  </td>
                  <td>
                    <Badge color={p.status === 'PUBLISHED' ? 'green' : p.status === 'DRAFT' ? 'amber' : 'gray'}>{p.status}</Badge>
                  </td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {p.isFeatured && <Badge color="gold">Featured</Badge>}
                      {p.isBestSeller && <Badge color="blue">Best</Badge>}
                      {p.isRecommended && <Badge color="violet">Rec</Badge>}
                    </div>
                  </td>
                  <td className="font-semibold">{p.soldCount}</td>
                  <td className="text-[12px] text-ink/50">{formatDate(p.updatedAt)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/admin/products/${p.id}/edit`} className="p-2 rounded-lg hover:bg-brand-50 text-ink/55 hover:text-brand-700" aria-label="Edit"><Pencil size={15} /></Link>
                      <button className="p-2 rounded-lg hover:bg-brand-50 text-ink/55 hover:text-brand-700" onClick={() => duplicate(p.id)} aria-label="Duplicate"><Copy size={15} /></button>
                      <button className="p-2 rounded-lg hover:bg-red-50 text-ink/55 hover:text-red-600" onClick={() => setConfirm({ id: p.id, title: p.title })} aria-label="Delete"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination page={pagination.page} pages={pagination.pages} onChange={(p) => { load(p); window.scrollTo({ top: 0 }); }} />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={del}
        busy={deleting}
        title="Delete product"
        message={`Are you sure you want to delete "${confirm?.title}"? This archives the product and it will no longer appear in the store.`}
      />

      <Modal open={importOpen} onClose={() => { setImportOpen(false); setImportResult(null); setCsvText(''); }} title="Import products (CSV)" wide>
        {importResult ? (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-extrabold text-emerald-600">{importResult.created}</p>
                <p className="text-xs font-bold text-emerald-700/70">Created</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-extrabold text-blue-600">{importResult.updated}</p>
                <p className="text-xs font-bold text-blue-700/70">Updated</p>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div className="bg-red-50 rounded-xl p-4 max-h-48 overflow-y-auto">
                <p className="text-xs font-bold text-red-600 mb-2">{importResult.errors.length} errors:</p>
                <ul className="text-[11px] text-red-500/90 grid gap-1 font-mono">
                  {importResult.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            <button className="btn-primary !py-2.5" onClick={() => { setImportOpen(false); setImportResult(null); load(1); }}>Done</button>
          </div>
        ) : (
          <div className="grid gap-3">
            <p className="text-sm text-ink/55">
              Paste CSV content with columns: <code className="bg-cream px-1.5 py-0.5 rounded text-xs">sku, title, title_ar, description, price, compare_at_price, cost_price, stock, category, brand, status, featured, best_seller, recommended, tags, image_urls</code>. Download the template for an example.
            </p>
            <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} className="input min-h-[220px] font-mono text-xs" placeholder="sku,title,price,stock&#10;SKU-1,My Product,99,50" />
            <button className="btn-primary !py-2.5" onClick={doImport} disabled={importBusy}>
              {importBusy && <Spinner className="h-4 w-4" />} Import
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ================= Product form =================
interface CategoryOption { id: number; name: string; parentId: number | null }
interface BrandOption { id: number; name: string }

export function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = !!id;

  const [form, setForm] = useState({
    title: '', titleAr: '', sku: '', slug: '', price: '', compareAtPrice: '', costPrice: '',
    stock: '0', lowStockThreshold: '5', categoryId: '', brandId: '', status: 'DRAFT',
    isFeatured: false, isBestSeller: false, isRecommended: false,
    description: '', descriptionAr: '', shippingNote: '', shippingNoteAr: '',
    tags: '', seoTitle: '', seoDescription: '', videoUrl: '', dimensions: '', weightKg: '',
    specifications: [] as { label: string; value: string }[],
    images: [] as { url: string; alt?: string; isThumbnail?: boolean }[],
    variants: [] as { id?: number; name: string; sku: string; size?: string; color?: string; priceDelta: string; stock: string }[],
  });
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [media, setMedia] = useState<{ id: number; url: string; filename: string }[]>([]);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<CategoryOption[]>('/api/admin/categories/flat').then(setCategories).catch(() => undefined);
    api.get<BrandOption[]>('/api/admin/categories/brands').then(setBrands).catch(() => undefined);
    api.get<{ items: { id: number; url: string; filename: string }[] }>('/api/admin/media?limit=60').then((d) => setMedia(d.items)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get<{ product: Product & { costPrice?: number | null; status?: string } }>(`/api/admin/products/${id}`)
      .then((d) => {
        const p = d.product;
        setForm({
          title: p.titleEn, titleAr: p.titleAr || '', sku: p.sku, slug: p.slug,
          price: String(p.price), compareAtPrice: p.compareAtPrice != null ? String(p.compareAtPrice) : '',
          costPrice: p.costPrice != null ? String(p.costPrice) : '',
          stock: String(p.stock), lowStockThreshold: String(p.lowStockThreshold),
          categoryId: p.category ? String(p.category.id) : '', brandId: p.brand ? String(p.brand.id) : '',
          status: p.status || 'DRAFT',
          isFeatured: p.isFeatured, isBestSeller: p.isBestSeller, isRecommended: p.isRecommended,
          description: p.descriptionEn || '', descriptionAr: p.descriptionAr || '',
          shippingNote: p.shippingNote || '', shippingNoteAr: '',
          tags: p.tags.join(', '), seoTitle: p.seoTitle || '', seoDescription: p.seoDescription || '',
          videoUrl: p.videoUrl || '', dimensions: p.dimensions || '', weightKg: p.weightKg != null ? String(p.weightKg) : '',
          specifications: p.specifications || [],
          images: p.images.map((i) => ({ url: i.url, alt: i.alt || '', isThumbnail: i.id === p.images[0]?.id })),
          variants: p.variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku, size: v.size || '', color: v.color || '', priceDelta: String(v.price - p.price), stock: String(v.stock) })),
        });
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (k: string, v: unknown) => setForm((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.title.trim() || !form.sku.trim() || !Number(form.price)) {
      toast.push('error', 'Title, SKU and price are required');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      price: Number(form.price),
      compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null,
      costPrice: form.costPrice ? Number(form.costPrice) : null,
      stock: Number(form.stock) || 0,
      lowStockThreshold: Number(form.lowStockThreshold) || 5,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      brandId: form.brandId ? Number(form.brandId) : null,
      weightKg: form.weightKg ? Number(form.weightKg) : null,
      tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
      variants: form.variants.map((v) => ({ ...v, priceDelta: Number(v.priceDelta) || 0, stock: Number(v.stock) || 0 })),
    };
    try {
      if (isEdit) {
        await api.patch(`/api/admin/products/${id}`, payload);
        toast.push('success', 'Product updated');
      } else {
        const res = await api.post<{ id: number }>('/api/admin/products', payload);
        toast.push('success', 'Product created');
        navigate(`/admin/products/${res.id}/edit`, { replace: true });
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-sm text-ink/40">Loading product…</div>;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Product' : 'Add Product'}
        subtitle={isEdit ? form.sku : 'Create a new product'}
        actions={
          <>
            <button className="btn-outline !py-2 !px-4 text-sm" onClick={() => navigate('/admin/products')}>Cancel</button>
            <button className="btn-primary !py-2 !px-5 text-sm" onClick={save} disabled={saving}>
              {saving && <Spinner className="h-4 w-4" />} {isEdit ? 'Save Changes' : 'Create Product'}
            </button>
          </>
        }
      />

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5 mb-4">{error}</div>}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 grid gap-5 content-start">
          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <p className="font-bold text-sm mb-4">General</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Title (English)" required>
                  <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} />
                </Field>
              </div>
              <Field label="Title (Arabic)">
                <input className="input" value={form.titleAr} onChange={(e) => set('titleAr', e.target.value)} dir="rtl" />
              </Field>
              <Field label="SKU" required>
                <input className="input" value={form.sku} onChange={(e) => set('sku', e.target.value)} />
              </Field>
              <Field label="URL slug" hint="Leave empty to auto-generate from title">
                <input className="input" value={form.slug} onChange={(e) => set('slug', e.target.value)} dir="ltr" />
              </Field>
              <Field label="Status">
                <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description (English)">
                  <textarea className="input min-h-[120px]" value={form.description} onChange={(e) => set('description', e.target.value)} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Description (Arabic)">
                  <textarea className="input min-h-[120px]" value={form.descriptionAr} onChange={(e) => set('descriptionAr', e.target.value)} dir="rtl" />
                </Field>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <p className="font-bold text-sm mb-4">Pricing & Inventory</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Price (AED)" required>
                <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} />
              </Field>
              <Field label="Compare-at price (AED)" hint="For discount display">
                <input className="input" type="number" min="0" step="0.01" value={form.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value)} />
              </Field>
              <Field label="Cost price (AED)" hint="Used for profit estimate">
                <input className="input" type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} />
              </Field>
              <Field label="Stock">
                <input className="input" type="number" min="0" value={form.stock} onChange={(e) => set('stock', e.target.value)} />
              </Field>
              <Field label="Low-stock threshold">
                <input className="input" type="number" min="0" value={form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', e.target.value)} />
              </Field>
              <Field label="Weight (kg)">
                <input className="input" type="number" min="0" step="0.001" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <p className="font-bold text-sm mb-4">Flags & Organization</p>
            <div className="flex flex-wrap gap-5 mb-4">
              {(['isFeatured', 'isBestSeller', 'isRecommended'] as const).map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input type="checkbox" className="accent-brand-700 h-4 w-4" checked={form[f]} onChange={(e) => set(f, e.target.checked)} />
                  {f === 'isFeatured' ? 'Featured' : f === 'isBestSeller' ? 'Best seller' : 'Recommended'}
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <select className="input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                  <option value="">— None —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Brand">
                <select className="input" value={form.brandId} onChange={(e) => set('brandId', e.target.value)}>
                  <option value="">— None —</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Tags" hint="Comma separated">
                  <input className="input" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="gadget, new, trending" />
                </Field>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <p className="font-bold text-sm mb-4">Shipping</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Dimensions">
                <input className="input" value={form.dimensions} onChange={(e) => set('dimensions', e.target.value)} placeholder="20 x 15 x 10 cm" />
              </Field>
              <Field label="Shipping note">
                <input className="input" value={form.shippingNote} onChange={(e) => set('shippingNote', e.target.value)} placeholder="Ships within 24 hours" />
              </Field>
              <Field label="Shipping note (Arabic)">
                <input className="input" value={form.shippingNoteAr} onChange={(e) => set('shippingNoteAr', e.target.value)} dir="rtl" />
              </Field>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <p className="font-bold text-sm mb-4">Specifications</p>
            <div className="grid gap-2">
              {form.specifications.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input !py-2 text-sm" placeholder="Label" value={s.label} onChange={(e) => set('specifications', form.specifications.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)))} />
                  <input className="input !py-2 text-sm" placeholder="Value" value={s.value} onChange={(e) => set('specifications', form.specifications.map((x, xi) => (xi === i ? { ...x, value: e.target.value } : x)))} />
                  <button className="p-2 text-red-500 shrink-0" onClick={() => set('specifications', form.specifications.filter((_, xi) => xi !== i))} aria-label="Remove spec"><Trash2 size={16} /></button>
                </div>
              ))}
              <button className="btn-outline !py-2 text-sm justify-self-start" onClick={() => set('specifications', [...form.specifications, { label: '', value: '' }])}>
                <Plus size={15} /> Add specification
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <p className="font-bold text-sm mb-4">SEO</p>
            <div className="grid gap-4">
              <Field label="SEO title">
                <input className="input" value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} />
              </Field>
              <Field label="SEO description">
                <textarea className="input min-h-[70px]" value={form.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} />
              </Field>
              <Field label="Product video URL">
                <input className="input" value={form.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} dir="ltr" placeholder="https://…" />
              </Field>
            </div>
          </div>
        </div>

        <div className="grid gap-5 content-start">
          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-sm">Images</p>
              <button className="btn-outline !py-1.5 !px-3 text-xs" onClick={() => setMediaOpen(true)}>Library</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {form.images.map((img, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-cream border border-ink/8 group">
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  <button className="absolute top-1 end-1 p-1 bg-white/90 rounded-lg text-red-500 opacity-0 group-hover:opacity-100" onClick={() => set('images', form.images.filter((_, xi) => xi !== i))} aria-label="Remove image">
                    <Trash2 size={13} />
                  </button>
                  {i === 0 && <span className="absolute bottom-1 start-1 chip bg-brand-700 text-white text-[8px]">Main</span>}
                </div>
              ))}
              <button className="aspect-square rounded-xl border-2 border-dashed border-ink/15 text-ink/35 flex flex-col items-center justify-center gap-1 hover:border-brand-500 hover:text-brand-600" onClick={() => setMediaOpen(true)}>
                <Plus size={20} />
                <span className="text-[10px] font-bold">Add</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <p className="font-bold text-sm mb-4">Variants (size / color)</p>
            {form.variants.length === 0 && <p className="text-xs text-ink/40 mb-3">No variants — single product.</p>}
            <div className="grid gap-3">
              {form.variants.map((v, i) => (
                <div key={i} className="border border-ink/8 rounded-xl p-3 grid gap-2">
                  <div className="flex gap-2">
                    <input className="input !py-1.5 text-xs flex-1" placeholder="Name (e.g. Black / M)" value={v.name} onChange={(e) => set('variants', form.variants.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))} />
                    <button className="p-1.5 text-red-500" onClick={() => set('variants', form.variants.filter((_, xi) => xi !== i))} aria-label="Remove variant"><Trash2 size={15} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input className="input !py-1.5 text-xs" placeholder="SKU" value={v.sku} onChange={(e) => set('variants', form.variants.map((x, xi) => (xi === i ? { ...x, sku: e.target.value } : x)))} />
                    <input className="input !py-1.5 text-xs" placeholder="Δ Price (AED)" type="number" value={v.priceDelta} onChange={(e) => set('variants', form.variants.map((x, xi) => (xi === i ? { ...x, priceDelta: e.target.value } : x)))} />
                    <input className="input !py-1.5 text-xs" placeholder="Color" value={v.color || ''} onChange={(e) => set('variants', form.variants.map((x, xi) => (xi === i ? { ...x, color: e.target.value } : x)))} />
                    <input className="input !py-1.5 text-xs" placeholder="Stock" type="number" value={v.stock} onChange={(e) => set('variants', form.variants.map((x, xi) => (xi === i ? { ...x, stock: e.target.value } : x)))} />
                  </div>
                </div>
              ))}
              <button className="btn-outline !py-2 text-sm" onClick={() => set('variants', [...form.variants, { name: '', sku: '', color: '', priceDelta: '0', stock: '0' }])}>
                <Plus size={15} /> Add variant
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <p className="font-bold text-sm mb-3">Quick actions</p>
            <div className="grid gap-2">
              <button className="btn-primary !py-2.5 text-sm" onClick={save} disabled={saving}>
                {saving && <Spinner className="h-4 w-4" />} {isEdit ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={mediaOpen} onClose={() => setMediaOpen(false)} title="Media library" wide>
        <div className="grid grid-cols-4 md:grid-cols-6 gap-2 max-h-[50vh] overflow-y-auto">
          {media.map((m) => (
            <button
              key={m.id}
              className="aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-brand-500"
              onClick={() => {
                set('images', [...form.images, { url: m.url }]);
                setMediaOpen(false);
              }}
            >
              <img src={m.url} alt={m.filename} className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
          {media.length === 0 && <p className="col-span-full text-sm text-ink/40 py-8 text-center">No media yet — upload images in Media Library.</p>}
        </div>
      </Modal>
    </div>
  );
}
