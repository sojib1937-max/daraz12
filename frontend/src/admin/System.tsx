// Admin users & roles, audit log, analytics + abandoned carts.
import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { useToast } from '../store';
import { PageHeader, ConfirmDialog, Field, EmptyRow, AdminPagination, StatCard } from './ui';
import { Badge, Modal, Spinner } from '../components/ui';
import { formatDate, aedShort } from '../lib/format';

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'gold', ADMIN: 'violet', MANAGER: 'blue', ORDER_MANAGER: 'green', PRODUCT_MANAGER: 'amber', VIEWER: 'gray',
};

// ---------------- Users & roles ----------------
interface AdminUser { id: number; email: string; name: string; role: string; isActive: boolean; totpEnabled: boolean; mustChangePassword: boolean; lastLoginAt: string | null; createdAt: string }

export function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<{ value: string; label: string; description: string; permissions: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{ id?: number; name: string; email: string; role: string; password: string; isActive: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ id: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRoleDetails, setShowRoleDetails] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<AdminUser[]>('/api/admin/users'),
      api.get<{ roles: typeof roles }>('/api/admin/users/roles'),
    ])
      .then(([u, r]) => {
        setUsers(u);
        setRoles(r.roles);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async () => {
    if (!editor || !editor.name.trim() || !editor.email.trim()) return;
    setBusy(true);
    try {
      if (editor.id) {
        const payload: Record<string, unknown> = { name: editor.name, email: editor.email, role: editor.role, isActive: editor.isActive };
        if (editor.password) payload.password = editor.password;
        await api.patch(`/api/admin/users/${editor.id}`, payload);
        toast.push('success', 'Admin updated');
      } else {
        await api.post('/api/admin/users', editor);
        toast.push('success', 'Admin created — a password-set link was emailed if no password was provided');
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
      await api.del(`/api/admin/users/${confirm.id}`);
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
        title="Admin Users & Roles"
        subtitle="Role-based access — enforced on the backend for every API call"
        actions={
          <>
            <button className="btn-outline !py-2 !px-3.5 text-sm" onClick={() => setShowRoleDetails(!showRoleDetails)}>
              <ShieldCheck size={15} /> Permissions
            </button>
            <button className="btn-primary !py-2 !px-4 text-sm" onClick={() => setEditor({ name: '', email: '', role: 'MANAGER', password: '', isActive: true })}>
              <Plus size={15} /> New Admin
            </button>
          </>
        }
      />

      {showRoleDetails && (
        <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5 mb-5 max-h-80 overflow-y-auto">
          <p className="font-bold text-sm mb-3">Role permissions</p>
          <div className="grid md:grid-cols-2 gap-4">
            {roles.map((r) => (
              <div key={r.value} className="border border-ink/8 rounded-xl p-3.5">
                <p className="font-bold text-sm flex items-center gap-2">
                  <Badge color={ROLE_COLORS[r.value]}>{r.label}</Badge>
                </p>
                <p className="text-[11px] text-ink/50 mb-2">{r.description}</p>
                <div className="flex flex-wrap gap-1">
                  {r.permissions.map((p) => (
                    <span key={p} className="text-[10px] bg-cream rounded-full px-2 py-0.5 text-ink/60">{p}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-ink/5 shadow-card overflow-x-auto">
        <table className="table-base min-w-[760px]">
          <thead>
            <tr><th>Admin</th><th>Role</th><th>2FA</th><th>Status</th><th>Last login</th><th className="!text-end">Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <EmptyRow colSpan={6} message="Loading…" />
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="h-9 w-9 rounded-full bg-brand-50 text-brand-700 font-bold text-xs flex items-center justify-center">{u.name.charAt(0)}</span>
                      <div>
                        <p className="font-bold text-[13px]">{u.name}</p>
                        <p className="text-[11px] text-ink/45">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td><Badge color={ROLE_COLORS[u.role]}>{u.role.replace('_', ' ')}</Badge></td>
                  <td><Badge color={u.totpEnabled ? 'green' : 'gray'}>{u.totpEnabled ? 'Enabled' : 'Off'}</Badge></td>
                  <td><Badge color={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Active' : 'Disabled'}</Badge></td>
                  <td className="text-[12px] text-ink/50">{u.lastLoginAt ? formatDate(u.lastLoginAt, { withTime: true }) : 'Never'}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button className="p-2 rounded-lg hover:bg-brand-50 text-ink/55" onClick={() => setEditor({ id: u.id, name: u.name, email: u.email, role: u.role, password: '', isActive: u.isActive })} aria-label="Edit"><Pencil size={14} /></button>
                      <button className="p-2 rounded-lg hover:bg-red-50 text-ink/55 hover:text-red-600" onClick={() => setConfirm({ id: u.id, name: u.name })} aria-label="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor?.id ? 'Edit admin' : 'New admin'}>
        {editor && (
          <div className="grid gap-4">
            <Field label="Name" required>
              <input className="input" value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
            </Field>
            <Field label="Email" required>
              <input className="input" type="email" value={editor.email} onChange={(e) => setEditor({ ...editor, email: e.target.value })} />
            </Field>
            <Field label="Role">
              <select className="input" value={editor.role} onChange={(e) => setEditor({ ...editor, role: e.target.value })}>
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>{r.label} — {r.description}</option>
                ))}
              </select>
            </Field>
            <Field label={editor.id ? 'New password (leave empty to keep current)' : 'Password (leave empty to email a set-password link)'}>
              <input className="input" type="password" value={editor.password} onChange={(e) => setEditor({ ...editor, password: e.target.value })} placeholder="Min 8 characters" />
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input type="checkbox" className="accent-brand-700" checked={editor.isActive} onChange={(e) => setEditor({ ...editor, isActive: e.target.checked })} />
              Active
            </label>
            <button className="btn-primary !py-2.5" onClick={save} disabled={busy}>
              {busy && <Spinner className="h-4 w-4" />} Save
            </button>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={del} busy={busy} title="Delete admin" message={`Delete "${confirm?.name}"? All their sessions are revoked immediately.`} />
    </div>
  );
}

// ---------------- Audit log ----------------
interface AuditRow { id: number; adminName: string; action: string; entityType: string | null; entityId: string | null; details: Record<string, unknown>; ip: string | null; createdAt: string }

export function AuditPage() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = (page = 1) => {
    setLoading(true);
    api
      .get<{ items: AuditRow[]; pagination: typeof pagination }>(`/api/admin/audit?page=${page}&q=${encodeURIComponent(q)}`)
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

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Every important admin action, with who and when" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action, admin, entity…" className="input !w-80 mb-4" aria-label="Search audit log" />
      <div className="bg-white rounded-2xl border border-ink/5 shadow-card overflow-x-auto">
        <table className="table-base min-w-[820px]">
          <thead>
            <tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th><th>IP</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <EmptyRow colSpan={5} message="Loading…" />
            ) : (
              items.map((a) => (
                <tr key={a.id}>
                  <td className="text-[12px] text-ink/50 whitespace-nowrap">{formatDate(a.createdAt, { withTime: true })}</td>
                  <td className="font-semibold text-[13px]">{a.adminName}</td>
                  <td>
                    <Badge color="brand">{a.action}</Badge>
                  </td>
                  <td className="text-[12px] text-ink/55">
                    {a.entityType && <span className="font-semibold">{a.entityType}</span>}
                    {a.entityId && <span className="text-ink/40"> #{a.entityId}</span>}
                  </td>
                  <td className="text-[12px] text-ink/40" dir="ltr">{a.ip || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <AdminPagination page={pagination.page} pages={pagination.pages} onChange={(p) => { load(p); window.scrollTo({ top: 0 }); }} />
    </div>
  );
}

// ---------------- Analytics & abandoned carts ----------------
interface CartSession { id: string; customer: { id: number; name: string; phone: string } | null; progress: string; itemCount: number; value: number; firstItemTitle: string; updatedAt: string; items: { productId?: number; quantity?: number; title?: string; price?: number; image?: string }[] }

export function AnalyticsPage() {
  const toast = useToast();
  const [range, setRange] = useState('30d');
  const [overview, setOverview] = useState<{ totals: Record<string, number>; byDay: Record<string, unknown>[] } | null>(null);
  const [carts, setCarts] = useState<CartSession[]>([]);
  const [cartsTotal, setCartsTotal] = useState(0);
  const [cartsLoading, setCartsLoading] = useState(true);
  const [cartsPage, setCartsPage] = useState(1);

  useEffect(() => {
    api
      .get<{ totals: Record<string, number>; byDay: Record<string, unknown>[] }>(`/api/admin/analytics/overview?range=${range}`)
      .then(setOverview)
      .catch(() => undefined);
  }, [range]);

  const loadCarts = (page = 1) => {
    setCartsLoading(true);
    api
      .get<{ items: CartSession[]; pagination: { page: number; limit: number; total: number; pages: number } }>(`/api/admin/carts/abandoned?page=${page}`)
      .then((d) => {
        setCarts(d.items);
        setCartsTotal(d.pagination.total);
      })
      .catch(() => undefined)
      .finally(() => setCartsLoading(false));
  };
  useEffect(() => loadCarts(cartsPage), [cartsPage]);

  const totals = overview?.totals || {};
  const chartData = Object.entries(totals).map(([k, v]) => ({ name: k.replace(/_/g, ' ').toLowerCase(), value: v }));

  return (
    <div>
      <PageHeader
        title="Analytics & Abandoned Carts"
        subtitle="Storefront events + recovery leads"
        actions={
          <select value={range} onChange={(e) => setRange(e.target.value)} className="input !w-auto !py-2 text-sm" aria-label="Range">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="month">This month</option>
          </select>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { l: 'Page views', v: totals.PAGE_VIEW || 0 },
          { l: 'Product views', v: totals.PRODUCT_VIEW || 0 },
          { l: 'Add to cart', v: totals.ADD_TO_CART || 0 },
          { l: 'Checkout started', v: totals.CHECKOUT_STARTED || 0 },
          { l: 'Orders placed', v: totals.ORDER_PLACED || 0 },
        ].map((s) => (
          <StatCard key={s.l} label={s.l} value={s.v} />
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5 mb-5">
        <p className="font-bold text-sm mb-3">Funnel</p>
        <div className="flex items-end gap-2 h-40">
          {chartData.map((d) => (
            <div key={d.name} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-extrabold">{d.value}</span>
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-brand-700 to-brand-400 transition-all"
                style={{ height: `${Math.max(4, (d.value / Math.max(1, ...chartData.map((x) => x.value))) * 100)}%` }}
                title={`${d.name}: ${d.value}`}
              />
              <span className="text-[9px] font-bold uppercase text-ink/40 text-center">{d.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-sm">Abandoned carts (last 14 days) — {cartsTotal}</p>
          <span className="text-[11px] text-ink/40">Architecture ready: sessions stored server-side; enable remarketing campaigns with explicit consent</span>
        </div>
        <div className="grid gap-2 max-h-[420px] overflow-y-auto">
          {cartsLoading ? (
            <div className="h-24 skeleton" />
          ) : carts.length === 0 ? (
            <p className="text-sm text-ink/40 py-8 text-center">No abandoned carts yet — carts sync automatically as customers browse.</p>
          ) : (
            carts.map((c) => (
              <div key={c.id} className="border border-ink/8 rounded-xl p-3 flex flex-wrap items-center gap-3">
                <div className="flex -space-x-2">
                  {c.items.slice(0, 3).map((i, idx) =>
                    i.image ? (
                      <img key={idx} src={i.image} alt="" className="h-9 w-9 rounded-lg object-cover border-2 border-white" />
                    ) : (
                      <span key={idx} className="h-9 w-9 rounded-lg bg-cream border-2 border-white" />
                    )
                  )}
                </div>
                <div className="flex-1 min-w-[160px]">
                  <p className="text-[13px] font-bold line-clamp-1">{c.firstItemTitle || 'Empty cart'}</p>
                  <p className="text-[11px] text-ink/45">
                    {c.customer ? c.customer.name : 'Guest'} • {c.progress.replace('_', ' ').toLowerCase()} • {formatDate(c.updatedAt, { withTime: true })}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-extrabold text-brand-800">{aedShort(c.value)}</p>
                  <p className="text-[11px] text-ink/40">{c.itemCount} items</p>
                </div>
                <button
                  className="btn-outline !py-1.5 !px-3 text-xs"
                  onClick={() => {
                    if (!c.customer) {
                      toast.push('info', 'Guest cart — no contact info saved (privacy by design)');
                      return;
                    }
                    const msg = `Hello ${c.customer.name}! 👋 You left items in your DesertCart. We can still deliver with Cash on Delivery — would you like to complete your order?`;
                    window.open(`https://wa.me/${c.customer.phone}?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                >
                  Recover via WhatsApp
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
