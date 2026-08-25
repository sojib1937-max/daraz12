// Admin categories + brands management.
import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { useToast } from '../store';
import { PageHeader, ConfirmDialog, Field, EmptyRow } from './ui';
import { Modal, Badge, Spinner } from '../components/ui';

interface CategoryNode {
  id: number; name: string; nameAr: string | null; slug: string; sortOrder: number; isActive: boolean;
  imageUrl: string | null; bannerUrl: string | null; productCount: number;
  children: { id: number; name: string; nameAr: string | null; slug: string; sortOrder: number; isActive: boolean; productCount: number }[];
}
interface Brand { id: number; name: string; slug: string; logoUrl: string | null; isActive: boolean; productCount: number }

export function Categories() {
  const toast = useToast();
  const [cats, setCats] = useState<CategoryNode[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{ id?: number; name: string; nameAr: string; slug: string; sortOrder: number; isActive: boolean; imageUrl: string; parentId: number | null } | null>(null);
  const [brandEditor, setBrandEditor] = useState<{ id?: number; name: string; isActive: boolean; logoUrl: string } | null>(null);
  const [confirm, setConfirm] = useState<{ type: 'cat' | 'brand'; id: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get<CategoryNode[]>('/api/admin/categories'), api.get<Brand[]>('/api/admin/categories/brands')])
      .then(([c, b]) => {
        setCats(c);
        setBrands(b);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const saveCat = async () => {
    if (!editor) return;
    setBusy(true);
    try {
      if (editor.id) {
        await api.patch(`/api/admin/categories/${editor.id}`, editor);
        toast.push('success', 'Category updated');
      } else {
        await api.post('/api/admin/categories', editor);
        toast.push('success', 'Category created');
      }
      setEditor(null);
      load();
    } catch (e) {
      toast.push('error', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const saveBrand = async () => {
    if (!brandEditor || !brandEditor.name.trim()) return;
    setBusy(true);
    try {
      if (brandEditor.id) {
        await api.patch(`/api/admin/categories/brands/${brandEditor.id}`, brandEditor);
        toast.push('success', 'Brand updated');
      } else {
        await api.post('/api/admin/categories/brands', brandEditor);
        toast.push('success', 'Brand created');
      }
      setBrandEditor(null);
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
      if (confirm.type === 'cat') await api.del(`/api/admin/categories/${confirm.id}`);
      else await api.del(`/api/admin/categories/brands/${confirm.id}`);
      toast.push('success', 'Deleted');
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
        title="Categories & Brands"
        subtitle="Organize your catalog"
        actions={
          <>
            <button className="btn-outline !py-2 !px-3.5 text-sm" onClick={() => setBrandEditor({ name: '', isActive: true, logoUrl: '' })}>
              <Plus size={15} /> Brand
            </button>
            <button className="btn-primary !py-2 !px-3.5 text-sm" onClick={() => setEditor({ name: '', nameAr: '', slug: '', sortOrder: 0, isActive: true, imageUrl: '', parentId: null })}>
              <Plus size={15} /> Category
            </button>
          </>
        }
      />

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-ink/5 shadow-card overflow-x-auto">
          <table className="table-base min-w-[560px]">
            <thead>
              <tr><th>Category</th><th>Slug</th><th>Products</th><th>Status</th><th className="!text-end">Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <EmptyRow colSpan={5} message="Loading…" />
              ) : (
                cats.map((c) => (
                  <React.Fragment key={c.id}>
                    <tr className="!bg-cream/70">
                      <td className="font-bold text-[13px]">{c.name}{c.nameAr && <span className="text-ink/40 ms-1.5" dir="rtl">{c.nameAr}</span>}</td>
                      <td className="text-[12px] text-ink/45" dir="ltr">{c.slug}</td>
                      <td className="font-semibold">{c.productCount}</td>
                      <td><Badge color={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'Active' : 'Hidden'}</Badge></td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button className="p-2 rounded-lg hover:bg-brand-50 text-ink/55" onClick={() => setEditor({ id: c.id, name: c.name, nameAr: c.nameAr || '', slug: c.slug, sortOrder: c.sortOrder, isActive: c.isActive, imageUrl: c.imageUrl || '', parentId: null })} aria-label="Edit"><Pencil size={14} /></button>
                          <button className="p-2 rounded-lg hover:bg-red-50 text-ink/55 hover:text-red-600" onClick={() => setConfirm({ type: 'cat', id: c.id, name: c.name })} aria-label="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                    {c.children.map((ch) => (
                      <tr key={ch.id}>
                        <td className="ps-10 text-[13px]">↳ {ch.name}</td>
                        <td className="text-[12px] text-ink/45" dir="ltr">{ch.slug}</td>
                        <td className="font-semibold">{ch.productCount}</td>
                        <td><Badge color={ch.isActive ? 'green' : 'gray'}>{ch.isActive ? 'Active' : 'Hidden'}</Badge></td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <button className="p-2 rounded-lg hover:bg-brand-50 text-ink/55" onClick={() => setEditor({ id: ch.id, name: ch.name, nameAr: ch.nameAr || '', slug: ch.slug, sortOrder: ch.sortOrder, isActive: ch.isActive, imageUrl: '', parentId: c.id })} aria-label="Edit"><Pencil size={14} /></button>
                            <button className="p-2 rounded-lg hover:bg-red-50 text-ink/55 hover:text-red-600" onClick={() => setConfirm({ type: 'cat', id: ch.id, name: ch.name })} aria-label="Delete"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl border border-ink/5 shadow-card overflow-x-auto">
          <table className="table-base min-w-[460px]">
            <thead>
              <tr><th>Brand</th><th>Products</th><th>Status</th><th className="!text-end">Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <EmptyRow colSpan={4} message="Loading…" />
              ) : (
                brands.map((b) => (
                  <tr key={b.id}>
                    <td className="font-bold text-[13px]">{b.name}</td>
                    <td className="font-semibold">{b.productCount}</td>
                    <td><Badge color={b.isActive ? 'green' : 'gray'}>{b.isActive ? 'Active' : 'Hidden'}</Badge></td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button className="p-2 rounded-lg hover:bg-brand-50 text-ink/55" onClick={() => setBrandEditor({ id: b.id, name: b.name, isActive: b.isActive, logoUrl: b.logoUrl || '' })} aria-label="Edit"><Pencil size={14} /></button>
                        <button className="p-2 rounded-lg hover:bg-red-50 text-ink/55 hover:text-red-600" onClick={() => setConfirm({ type: 'brand', id: b.id, name: b.name })} aria-label="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor?.id ? 'Edit category' : 'New category'}>
        {editor && (
          <div className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Name (English)" required>
                <input className="input" value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
              </Field>
              <Field label="Name (Arabic)">
                <input className="input" value={editor.nameAr} onChange={(e) => setEditor({ ...editor, nameAr: e.target.value })} dir="rtl" />
              </Field>
              <Field label="Slug" hint="Leave empty to auto-generate">
                <input className="input" value={editor.slug} onChange={(e) => setEditor({ ...editor, slug: e.target.value })} dir="ltr" />
              </Field>
              <Field label="Image URL">
                <input className="input" value={editor.imageUrl} onChange={(e) => setEditor({ ...editor, imageUrl: e.target.value })} dir="ltr" placeholder="/images/categories/x.jpg" />
              </Field>
              <Field label="Sort order">
                <input className="input" type="number" value={editor.sortOrder} onChange={(e) => setEditor({ ...editor, sortOrder: Number(e.target.value) })} />
              </Field>
              <label className="flex items-center gap-2 text-sm font-semibold self-end pb-2 cursor-pointer">
                <input type="checkbox" className="accent-brand-700" checked={editor.isActive} onChange={(e) => setEditor({ ...editor, isActive: e.target.checked })} />
                Visible in store
              </label>
            </div>
            <button className="btn-primary !py-2.5" onClick={saveCat} disabled={busy || !editor.name.trim()}>
              {busy && <Spinner className="h-4 w-4" />} Save category
            </button>
          </div>
        )}
      </Modal>

      <Modal open={!!brandEditor} onClose={() => setBrandEditor(null)} title={brandEditor?.id ? 'Edit brand' : 'New brand'}>
        {brandEditor && (
          <div className="grid gap-4">
            <Field label="Brand name" required>
              <input className="input" value={brandEditor.name} onChange={(e) => setBrandEditor({ ...brandEditor, name: e.target.value })} />
            </Field>
            <Field label="Logo URL">
              <input className="input" value={brandEditor.logoUrl} onChange={(e) => setBrandEditor({ ...brandEditor, logoUrl: e.target.value })} dir="ltr" />
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input type="checkbox" className="accent-brand-700" checked={brandEditor.isActive} onChange={(e) => setBrandEditor({ ...brandEditor, isActive: e.target.checked })} />
              Active
            </label>
            <button className="btn-primary !py-2.5" onClick={saveBrand} disabled={busy || !brandEditor.name.trim()}>
              {busy && <Spinner className="h-4 w-4" />} Save brand
            </button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={del}
        busy={busy}
        title="Delete"
        message={`Delete "${confirm?.name}"? Products in this category/brand will be unassigned (not deleted).`}
      />
    </div>
  );
}
