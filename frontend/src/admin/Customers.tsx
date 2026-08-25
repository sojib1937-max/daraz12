// Admin customers: list + detail (orders, stats, notes).
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Download, Phone, Mail } from 'lucide-react';
import { api, downloadExport, friendlyError } from '../lib/api';
import { useToast } from '../store';
import { PageHeader, AdminPagination, SearchBox, FilterSelect, StatCard, EmptyRow } from './ui';
import { Badge } from '../components/ui';
import { aed, formatDate, ORDER_STATUS_LABELS, emirateName } from '../lib/format';

interface CustomerRow {
  id: number; name: string; phone: string; email: string | null; isDemo: boolean; notes: string | null;
  orderCount: number; totalSpent: number; cancelledCount: number; lastOrderAt: string | null; createdAt: string;
}

export function Customers() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CustomerRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [hasOrders, setHasOrders] = useState('ALL');

  const load = (page = 1) => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '20', hasOrders });
    if (q) qs.set('q', q);
    api
      .get<{ items: CustomerRow[]; pagination: typeof pagination }>(`/api/admin/customers?${qs}`)
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
  }, [q, hasOrders]);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${pagination.total} customers`}
        actions={
          <button className="btn-outline !py-2 !px-3.5 text-sm" onClick={() => downloadExport('/api/admin/customers/export', `customers-${new Date().toISOString().slice(0, 10)}.csv`)}>
            <Download size={15} /> Export CSV
          </button>
        }
      />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Name, phone, email…" className="!w-72" />
        <FilterSelect value={hasOrders} onChange={setHasOrders} options={[{ v: 'ALL', l: 'All customers' }, { v: 'true', l: 'With orders' }, { v: 'false', l: 'No orders yet' }]} label="Orders" />
      </div>

      <div className="bg-white rounded-2xl border border-ink/5 shadow-card overflow-x-auto">
        <table className="table-base min-w-[860px]">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th>Orders</th>
              <th>Total spent</th>
              <th>Cancelled / failed</th>
              <th>Last order</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <EmptyRow colSpan={7} message="Loading…" />
            ) : items.length === 0 ? (
              <EmptyRow colSpan={7} message="No customers found" />
            ) : (
              items.map((c) => (
                <tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/admin/customers/${c.id}`)}>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="h-9 w-9 rounded-full bg-brand-50 text-brand-700 font-bold text-xs flex items-center justify-center shrink-0">{c.name.charAt(0)}</span>
                      <div>
                        <p className="font-bold text-[13px]">{c.name}</p>
                        {c.isDemo && <Badge color="gold" className="mt-0.5">Demo</Badge>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="text-[13px]" dir="ltr">{c.phone}</p>
                    {c.email && <p className="text-[11px] text-ink/45">{c.email}</p>}
                  </td>
                  <td className="font-bold">{c.orderCount}</td>
                  <td className="font-extrabold text-brand-800">{aed(c.totalSpent, { compact: true })}</td>
                  <td className={c.cancelledCount > 2 ? 'text-red-500 font-bold' : 'text-ink/55'}>{c.cancelledCount}</td>
                  <td className="text-[12px] text-ink/50">{c.lastOrderAt ? formatDate(c.lastOrderAt) : '—'}</td>
                  <td className="text-[12px] text-ink/50">{formatDate(c.createdAt)}</td>
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

// ---------------- Customer detail ----------------
export function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<{
    customer: { id: number; name: string; phone: string; email: string | null; notes: string | null; isDemo: boolean; createdAt: string; addresses: { id: number; label: string; emirate: string; area: string; address: string }[] };
    stats: { totalOrders: number; totalSpent: number; cancelledOrders: number; failedDeliveries: number; codOrders: number };
    orders: { id: number; orderNumber: string; total: number; status: string; emirate: string; placedAt: string; itemCount: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get<typeof data>(`/api/admin/customers/${id}`).then((d) => { setData(d); setNotes(d?.customer.notes || ''); }).catch(() => undefined).finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  const saveNotes = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/admin/customers/${id}`, { notes });
      toast.push('success', 'Notes saved');
      load();
    } catch (e) {
      toast.push('error', friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-sm text-ink/40">Loading customer…</div>;
  if (!data) return <div className="py-20 text-center text-sm text-ink/40">Customer not found</div>;
  const { customer, stats, orders } = data;

  return (
    <div>
      <PageHeader
        title={customer.name}
        subtitle={customer.isDemo ? 'Demo customer' : `Registered ${formatDate(customer.createdAt)}`}
        actions={<button className="btn-outline !py-2 !px-3.5 text-sm" onClick={() => navigate('/admin/customers')}>Back</button>}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Orders" value={stats.totalOrders} />
        <StatCard label="Total spent" value={aed(stats.totalSpent, { compact: true })} tone="green" />
        <StatCard label="Cancelled" value={stats.cancelledOrders} tone="red" />
        <StatCard label="Failed deliveries" value={stats.failedDeliveries} tone={stats.failedDeliveries > 1 ? 'red' : 'brand'} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-ink/5 shadow-card p-5">
          <p className="font-bold text-sm mb-4">Order history ({orders.length})</p>
          <div className="grid gap-2">
            {orders.length === 0 && <p className="text-sm text-ink/40 py-6 text-center">No orders yet</p>}
            {orders.map((o) => (
              <Link key={o.id} to={`/admin/orders/${o.id}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-brand-50/50 border border-ink/5">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-brand-800" dir="ltr">{o.orderNumber}</p>
                  <p className="text-[11px] text-ink/45">{formatDate(o.placedAt)} • {emirateName(o.emirate)} • {o.itemCount} items</p>
                </div>
                <Badge color={ORDER_STATUS_LABELS[o.status]?.color}>{ORDER_STATUS_LABELS[o.status]?.en}</Badge>
                <span className="font-extrabold text-[13px] w-20 text-end">{aed(o.total, { compact: true })}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-5 content-start">
          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <p className="font-bold text-sm mb-3">Contact</p>
            <p className="text-sm flex items-center gap-2"><Phone size={14} className="text-ink/35" /> <span dir="ltr">{customer.phone}</span></p>
            {customer.email && <p className="text-sm flex items-center gap-2 mt-2"><Mail size={14} className="text-ink/35" /> {customer.email}</p>}
            {customer.addresses.length > 0 && (
              <div className="mt-3 pt-3 border-t border-ink/8">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink/40 mb-1.5">Saved addresses</p>
                {customer.addresses.map((a) => (
                  <p key={a.id} className="text-xs text-ink/55 mb-1">{a.label}: {a.area}, {a.emirate} — {a.address}</p>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <p className="font-bold text-sm mb-3">Internal notes</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. prefers afternoon delivery, VIP customer…" className="input min-h-[90px] text-sm" />
            <button className="btn-primary w-full !py-2 text-sm mt-2" onClick={saveNotes} disabled={saving}>
              {saving ? 'Saving…' : 'Save notes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
