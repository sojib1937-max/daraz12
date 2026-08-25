// Admin reviews moderation + media library.
import React, { useEffect, useState } from 'react';
import { Check, X, Star, Trash2, Upload, Search, Image as ImageIcon } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { useToast } from '../store';
import { PageHeader, ConfirmDialog, FilterSelect, EmptyRow, AdminPagination } from './ui';
import { Badge, Stars, Spinner } from '../components/ui';
import { formatDate } from '../lib/format';

interface ReviewRow {
  id: number; rating: number; title: string | null; content: string; displayName: string;
  isApproved: boolean; isFeatured: boolean; isVerifiedPurchase: boolean; isDemo: boolean;
  imageUrl: string | null; product: { id: number; title: string; slug: string } | null; createdAt: string;
}

export function Reviews() {
  const toast = useToast();
  const [items, setItems] = useState<ReviewRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('PENDING');
  const [confirm, setConfirm] = useState<{ id: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = (page = 1) => {
    setLoading(true);
    api
      .get<{ items: ReviewRow[]; pagination: typeof pagination }>(`/api/admin/reviews?page=${page}&status=${status}`)
      .then((d) => {
        setItems(d.items);
        setPagination(d.pagination);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };
  useEffect(() => load(1), [status]);

  const moderate = async (id: number, patch: { isApproved?: boolean; isFeatured?: boolean }) => {
    try {
      await api.patch(`/api/admin/reviews/${id}`, patch);
      toast.push('success', patch.isApproved !== undefined ? (patch.isApproved ? 'Review approved' : 'Review rejected') : 'Updated');
      load(pagination.page);
    } catch (e) {
      toast.push('error', friendlyError(e));
    }
  };

  const del = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await api.del(`/api/admin/reviews/${confirm.id}`);
      setConfirm(null);
      load(pagination.page);
    } catch (e) {
      toast.push('error', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Reviews"
        subtitle="Moderate customer reviews"
        actions={
          <FilterSelect
            value={status}
            onChange={setStatus}
            options={[
              { v: 'PENDING', l: 'Pending approval' },
              { v: 'APPROVED', l: 'Approved' },
              { v: 'ALL', l: 'All reviews' },
            ]}
            label="Status"
          />
        }
      />

      <div className="bg-white rounded-2xl border border-ink/5 shadow-card overflow-x-auto">
        <table className="table-base min-w-[860px]">
          <thead>
            <tr><th>Review</th><th>Product</th><th>Rating</th><th>Status</th><th>Date</th><th className="!text-end">Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <EmptyRow colSpan={6} message="Loading…" />
            ) : items.length === 0 ? (
              <EmptyRow colSpan={6} message="No reviews in this view" />
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td className="max-w-[320px]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="h-7 w-7 rounded-full bg-brand-50 text-brand-700 font-bold text-[10px] flex items-center justify-center shrink-0">{r.displayName.charAt(0)}</span>
                      <p className="font-bold text-[13px]">{r.displayName}</p>
                      {r.isDemo && <Badge color="gold">Demo</Badge>}
                      {r.isVerifiedPurchase && <Badge color="green">Verified</Badge>}
                    </div>
                    {r.title && <p className="text-[13px] font-semibold">{r.title}</p>}
                    <p className="text-xs text-ink/55 line-clamp-2">{r.content}</p>
                  </td>
                  <td className="text-[12px] font-semibold max-w-[180px]">
                    <span className="line-clamp-1">{r.product?.title || '—'}</span>
                  </td>
                  <td><Stars value={r.rating} size={13} /></td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <Badge color={r.isApproved ? 'green' : 'amber'}>{r.isApproved ? 'Approved' : 'Pending'}</Badge>
                      {r.isFeatured && <Badge color="gold">Featured</Badge>}
                    </div>
                  </td>
                  <td className="text-[12px] text-ink/50">{formatDate(r.createdAt)}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      {!r.isApproved && (
                        <button className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100" onClick={() => moderate(r.id, { isApproved: true })} title="Approve" aria-label="Approve">
                          <Check size={15} />
                        </button>
                      )}
                      {r.isApproved && (
                        <button className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100" onClick={() => moderate(r.id, { isApproved: false })} title="Reject" aria-label="Reject">
                          <X size={15} />
                        </button>
                      )}
                      <button
                        className={`p-2 rounded-lg ${r.isFeatured ? 'bg-gold-100 text-gold-700' : 'hover:bg-gold-50 text-ink/50'}`}
                        onClick={() => moderate(r.id, { isFeatured: !r.isFeatured })}
                        title={r.isFeatured ? 'Unfeature' : 'Feature on homepage'}
                        aria-label="Feature"
                      >
                        <Star size={15} className={r.isFeatured ? 'fill-gold-500' : ''} />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-red-50 text-ink/55 hover:text-red-600" onClick={() => setConfirm({ id: r.id, name: r.displayName })} title="Delete" aria-label="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination page={pagination.page} pages={pagination.pages} onChange={(p) => { load(p); window.scrollTo({ top: 0 }); }} />
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={del} busy={busy} title="Delete review" message={`Delete the review by "${confirm?.name}"? This also updates the product rating.`} />
    </div>
  );
}

// ================= Media library =================
interface MediaItem { id: number; url: string; filename: string; mimeType: string; size: number; createdAt: string }

export function Media() {
  const toast = useToast();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 30, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState<{ id: number; filename: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = (page = 1) => {
    setLoading(true);
    api
      .get<{ items: MediaItem[]; pagination: typeof pagination }>(`/api/admin/media?page=${page}&q=${encodeURIComponent(q)}`)
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

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append('files', f);
      const res = await api.post<{ items: MediaItem[]; errors: string[] }>('/api/admin/media/upload', undefined, { formData: fd });
      toast.push('success', `Uploaded ${res.items.length} image${res.items.length > 1 ? 's' : ''}${res.errors.length ? ` (${res.errors.length} failed)` : ''}`);
      if (res.errors.length) res.errors.slice(0, 3).forEach((e) => toast.push('error', e));
      load(1);
    } catch (e) {
      toast.push('error', friendlyError(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const del = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await api.del(`/api/admin/media/${confirm.id}`);
      setConfirm(null);
      load(pagination.page);
    } catch (e) {
      toast.push('error', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard?.writeText(url).then(() => toast.push('success', 'URL copied')).catch(() => undefined);
  };

  return (
    <div>
      <PageHeader
        title="Media Library"
        subtitle={`${pagination.total} assets`}
        actions={
          <>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} aria-label="Upload images" />
            <button className="btn-primary !py-2 !px-4 text-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Spinner className="h-4 w-4" /> : <Upload size={15} />} Upload Images
            </button>
          </>
        }
      />
      <div className="relative max-w-xs mb-5">
        <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink/35" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files…" className="input !ps-9" aria-label="Search media" />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
        {loading ? (
          [...Array(16)].map((_, i) => <div key={i} className="aspect-square rounded-xl skeleton" />)
        ) : items.length === 0 ? (
          <div className="col-span-full text-center py-16 text-ink/40 text-sm flex flex-col items-center gap-2">
            <ImageIcon size={32} className="opacity-40" />
            No images yet — upload your product photos.
          </div>
        ) : (
          items.map((m) => (
            <div key={m.id} className="group relative aspect-square rounded-xl overflow-hidden bg-cream border border-ink/8">
              <img src={m.url} alt={m.filename} className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                <button className="p-1.5 bg-white rounded-lg text-xs font-bold" onClick={() => copyUrl(m.url)} title="Copy URL">URL</button>
                <button className="p-1.5 bg-red-500 text-white rounded-lg" onClick={() => setConfirm({ id: m.id, filename: m.filename })} title="Delete"><Trash2 size={13} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      <AdminPagination page={pagination.page} pages={pagination.pages} onChange={(p) => { load(p); window.scrollTo({ top: 0 }); }} />
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={del} busy={busy} title="Delete image" message={`Delete "${confirm?.filename}"? Products using this image will show broken links — reassign them first.`} />
    </div>
  );
}
