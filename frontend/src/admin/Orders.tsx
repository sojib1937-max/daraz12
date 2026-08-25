// Admin orders: list (search/filter/bulk) + detail (status flow, notes, print).
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Download, Printer, MessageCircle, AlertTriangle, ClipboardList } from 'lucide-react';
import { api, downloadExport, friendlyError } from '../lib/api';
import { useToast } from '../store';
import { PageHeader, AdminPagination, SearchBox, FilterSelect, ConfirmDialog, EmptyRow } from './ui';
import { Badge, Modal, Spinner } from '../components/ui';
import { aed, formatDate, ORDER_STATUS_LABELS, EMIRATES } from '../lib/format';
import type { OrderDto, OrderStatus } from '../lib/types';

interface OrderRow {
  id: number; orderNumber: string; customerName: string; customerPhone: string; emirate: string; emirateLabel: string;
  total: number; status: OrderStatus; isDemo: boolean; placedAt: string; itemCount: number; riskCount: number;
  courierName: string | null; trackingNumber: string | null;
}

const STATUS_OPTS = [
  { v: 'ALL', l: 'All statuses' },
  ...Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => ({ v, l: l.en })),
];
const EMIRATE_OPTS = [{ v: 'ALL', l: 'All emirates' }, ...EMIRATES.map((e) => ({ v: e.key, l: e.en }))];

export function Orders() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<OrderRow[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(params.get('q') || '');
  const [status, setStatus] = useState('ALL');
  const [emirate, setEmirate] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = (page = 1) => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '20', status, emirate });
    if (q) qs.set('q', q);
    if (dateFrom) qs.set('dateFrom', dateFrom);
    if (dateTo) qs.set('dateTo', dateTo);
    if (flaggedOnly) qs.set('flagged', 'true');
    api
      .get<{ items: OrderRow[]; statusCounts: Record<string, number>; pagination: typeof pagination }>(`/api/admin/orders?${qs}`)
      .then((d) => {
        setItems(d.items);
        setStatusCounts(d.statusCounts);
        setPagination(d.pagination);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(() => load(1), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, emirate, dateFrom, dateTo, flaggedOnly]);

  const runBulk = async () => {
    if (!bulkStatus || selected.size === 0) return;
    setBulkBusy(true);
    try {
      await api.post('/api/admin/orders/bulk-status', { ids: [...selected], status: bulkStatus });
      toast.push('success', `Updated ${selected.size} orders to ${ORDER_STATUS_LABELS[bulkStatus]?.en}`);
      setSelected(new Set());
      setBulkConfirm(false);
      load(pagination.page);
    } catch (e) {
      toast.push('error', friendlyError(e));
    } finally {
      setBulkBusy(false);
    }
  };

  const flagged = items.filter((i) => i.riskCount > 0);

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle={`${pagination.total} orders${flagged.length ? ` • ${flagged.length} flagged for review` : ''}`}
        actions={
          <button className="btn-outline !py-2 !px-3.5 text-sm" onClick={() => downloadExport(`/api/admin/orders/export?status=${status}${dateFrom ? `&dateFrom=${dateFrom}` : ''}${dateTo ? `&dateTo=${dateTo}` : ''}`, `orders-${new Date().toISOString().slice(0, 10)}.csv`)}>
            <Download size={15} /> Export CSV
          </button>
        }
      />

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
        {Object.entries(statusCounts).map(([s, count]) => (
          <button
            key={s}
            onClick={() => setStatus(status === s ? 'ALL' : s)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              status === s ? 'bg-brand-700 text-white border-brand-700' : 'bg-white border-ink/10 text-ink/60 hover:border-brand-400'
            }`}
          >
            {ORDER_STATUS_LABELS[s]?.en || s}: {count}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Order #, phone, name, tracking…" className="!w-72" />
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTS} label="Status" />
        <FilterSelect value={emirate} onChange={setEmirate} options={EMIRATE_OPTS} label="Emirate" />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input !w-auto !py-2 text-sm" aria-label="From date" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input !w-auto !py-2 text-sm" aria-label="To date" />
        <label className="flex items-center gap-1.5 text-xs font-bold text-ink/55 cursor-pointer">
          <input type="checkbox" className="accent-brand-700" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
          Flagged only
        </label>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 ms-auto">
            <span className="text-xs font-bold">{selected.size} selected</span>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="input !w-auto !py-2 text-sm" aria-label="Bulk status">
              <option value="">Change status to…</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l.en}</option>
              ))}
            </select>
            <button className="btn-primary !py-2 !px-3 text-sm" disabled={!bulkStatus} onClick={() => setBulkConfirm(true)}>
              Apply
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-ink/5 shadow-card overflow-x-auto">
        <table className="table-base min-w-[980px]">
          <thead>
            <tr>
              <th className="!w-10"><input type="checkbox" className="accent-brand-700" checked={selected.size === items.length && items.length > 0} onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())} aria-label="Select all" /></th>
              <th>Order</th>
              <th>Customer</th>
              <th>Emirate</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Risk</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <EmptyRow colSpan={9} message="Loading…" />
            ) : items.length === 0 ? (
              <EmptyRow colSpan={9} message="No orders found" />
            ) : (
              items.map((o) => (
                <tr key={o.id} className="cursor-pointer" onClick={() => navigate(`/admin/orders/${o.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" className="accent-brand-700" checked={selected.has(o.id)} onChange={() => { const n = new Set(selected); n.has(o.id) ? n.delete(o.id) : n.add(o.id); setSelected(n); }} aria-label={`Select ${o.orderNumber}`} /></td>
                  <td>
                    <p className="font-bold text-brand-800 text-[13px]" dir="ltr">{o.orderNumber}</p>
                    {o.isDemo && <Badge color="gold" className="mt-0.5">Demo</Badge>}
                  </td>
                  <td>
                    <p className="font-semibold text-[13px]">{o.customerName}</p>
                    <p className="text-[11px] text-ink/40" dir="ltr">{o.customerPhone}</p>
                  </td>
                  <td className="text-[13px]">{o.emirateLabel}</td>
                  <td className="text-[13px] font-semibold">{o.itemCount}</td>
                  <td className="font-extrabold text-[13px]">{aed(o.total, { compact: true })}</td>
                  <td>
                    <Badge color={ORDER_STATUS_LABELS[o.status]?.color}>{ORDER_STATUS_LABELS[o.status]?.en}</Badge>
                  </td>
                  <td>
                    {o.riskCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                        <AlertTriangle size={11} /> {o.riskCount}
                      </span>
                    ) : (
                      <span className="text-ink/20">—</span>
                    )}
                  </td>
                  <td className="text-[12px] text-ink/50">{formatDate(o.placedAt, { withTime: true })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination page={pagination.page} pages={pagination.pages} onChange={(p) => { load(p); window.scrollTo({ top: 0 }); }} />

      <ConfirmDialog
        open={bulkConfirm}
        onClose={() => setBulkConfirm(false)}
        onConfirm={runBulk}
        busy={bulkBusy}
        title="Bulk status update"
        message={`Change ${selected.size} order(s) to "${bulkStatus ? ORDER_STATUS_LABELS[bulkStatus]?.en : ''}"? This records a status history entry for each order.`}
      />
    </div>
  );
}

// ================= Order detail =================
export function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [customerInfo, setCustomerInfo] = useState<{ id: number; name: string; phone: string; email: string | null; notes: string | null; createdAt: string } | null>(null);
  const [customerOrders, setCustomerOrders] = useState<{ orderNumber: string; status: string; total: number; placedAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [waMessage, setWaMessage] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);

  const load = () => {
    api
      .get<{ order: OrderDto; customer: typeof customerInfo; customerOrders: typeof customerOrders }>(`/api/admin/orders/${id}`)
      .then((d) => {
        setOrder(d.order);
        setCustomerInfo(d.customer);
        setCustomerOrders(d.customerOrders);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const changeStatus = async (status: OrderStatus) => {
    if (!order) return;
    setBusy(true);
    try {
      await api.patch(`/api/admin/orders/${order.id}/status`, { status, note: note || undefined, notifyCustomer: notify });
      toast.push('success', `Order marked as ${ORDER_STATUS_LABELS[status]?.en}`);
      setNote('');
      load();
    } catch (e) {
      toast.push('error', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = async (patch: { courierName?: string; trackingNumber?: string }) => {
    try {
      await api.patch(`/api/admin/orders/${order?.id}`, patch);
      toast.push('success', 'Order updated');
      load();
    } catch (e) {
      toast.push('error', friendlyError(e));
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      await api.post(`/api/admin/orders/${order?.id}/notes`, { note: note.trim() });
      setNote('');
      toast.push('success', 'Note added');
      load();
    } catch (e) {
      toast.push('error', friendlyError(e));
    }
  };

  const getWa = async () => {
    try {
      const res = await api.get<{ message: string }>(`/api/admin/orders/${order?.id}/whatsapp`);
      setWaMessage(res.message);
    } catch {
      /* ignore */
    }
  };

  if (loading) return <div className="py-20 text-center text-sm text-ink/40"><Spinner className="mx-auto h-6 w-6 text-brand-600 mb-2" />Loading order…</div>;
  if (!order) return <div className="py-20 text-center text-sm text-ink/40">Order not found</div>;

  const NEXT_STEPS: { from: OrderStatus[]; to: OrderStatus; label: string }[] = [
    { from: ['NEW'], to: 'CONFIRMED', label: 'Confirm order' },
    { from: ['CONFIRMED'], to: 'PROCESSING', label: 'Start processing' },
    { from: ['PROCESSING'], to: 'PACKED', label: 'Mark packed' },
    { from: ['PACKED'], to: 'SHIPPED', label: 'Mark shipped' },
    { from: ['SHIPPED'], to: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
    { from: ['OUT_FOR_DELIVERY', 'SHIPPED'], to: 'DELIVERED', label: 'Mark delivered' },
    { from: ['DELIVERED'], to: 'COD_COLLECTED', label: 'COD collected' },
  ];
  const nextStep = NEXT_STEPS.find((s) => s.from.includes(order.status));

  return (
    <div>
      <PageHeader
        title={order.orderNumber}
        subtitle={`Placed ${formatDate(order.placedAt, { withTime: true })}`}
        actions={
          <>
            <button className="btn-outline !py-2 !px-3.5 text-sm" onClick={() => window.open(`/api/admin/orders/${order.id}/invoice`, '_blank')}>
              <Printer size={15} /> Invoice
            </button>
            <button className="btn-outline !py-2 !px-3.5 text-sm" onClick={() => window.open(`/api/admin/orders/${order.id}/packing-slip`, '_blank')}>
              <ClipboardList size={15} /> Packing slip
            </button>
            <button className="btn-outline !py-2 !px-3.5 text-sm" onClick={getWa}>
              <MessageCircle size={15} /> WhatsApp msg
            </button>
            <button className="btn-outline !py-2 !px-3.5 text-sm" onClick={() => navigate('/admin/orders')}>Back</button>
          </>
        }
      />

      {order.riskFlags.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
          <p className="font-bold text-sm text-red-700 flex items-center gap-1.5 mb-2">
            <AlertTriangle size={15} /> Risk flags — review before shipping
          </p>
          <ul className="grid gap-1.5 text-xs text-red-600/90">
            {order.riskFlags.map((f, i) => (
              <li key={i}>• {f.type}: {f.reason}{f.detail ? ` (${f.detail})` : ''}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 grid gap-5 content-start">
          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge color={ORDER_STATUS_LABELS[order.status]?.color} className="!text-xs !px-3 !py-1">{ORDER_STATUS_LABELS[order.status]?.en}</Badge>
              {nextStep && (
                <button className="btn-primary !py-1.5 !px-3.5 text-xs" disabled={busy} onClick={() => changeStatus(nextStep.to)}>
                  {busy && <Spinner className="h-3 w-3" />} {nextStep.label} →
                </button>
              )}
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink/55 ms-auto">
                <input type="checkbox" className="accent-brand-700" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                SMS customer
              </label>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
              {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => {
                const reached = order.statusHistory.some((h) => h.status === s) || order.status === s;
                return (
                  <button
                    key={s}
                    disabled={busy}
                    onClick={() => changeStatus(s)}
                    title={`Set to ${ORDER_STATUS_LABELS[s]?.en}`}
                    className={`rounded-xl border px-2 py-2 text-[10px] font-bold transition-colors ${
                      order.status === s
                        ? 'bg-brand-700 text-white border-brand-700'
                        : reached
                        ? 'bg-brand-50 text-brand-700 border-brand-200'
                        : 'bg-white text-ink/45 border-ink/10 hover:border-brand-400'
                    }`}
                  >
                    {ORDER_STATUS_LABELS[s]?.en}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for this status change (optional)" className="input !py-2 text-sm flex-1" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <p className="font-bold text-sm mb-4">Items ({order.items.length})</p>
            <div className="grid gap-3">
              {order.items.map((i) => (
                <div key={i.id} className="flex items-center gap-3">
                  {i.imageUrl ? <img src={i.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover bg-cream" /> : <span className="h-14 w-14 rounded-xl bg-cream" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold line-clamp-1">{i.title}</p>
                    <p className="text-[11px] text-ink/40">{i.sku}{i.variantName ? ` • ${i.variantName}` : ''}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-bold text-sm">{aed(i.unitPrice)} × {i.quantity}</p>
                    <p className="text-xs font-extrabold text-brand-800">{aed(i.totalPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-ink/8 mt-4 pt-4 grid gap-1.5 text-sm">
              <div className="flex justify-between text-ink/60"><span>Subtotal</span><span>{aed(order.subtotal)}</span></div>
              {order.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span><span>-{aed(order.discount)}</span></div>}
              <div className="flex justify-between text-ink/60"><span>Shipping</span><span>{order.shippingFee === 0 ? 'FREE' : aed(order.shippingFee)}</span></div>
              {order.codFee > 0 && <div className="flex justify-between text-ink/60"><span>COD fee</span><span>{aed(order.codFee)}</span></div>}
              <div className="flex justify-between font-extrabold text-base pt-1"><span>Total (COD)</span><span className="text-brand-800">{aed(order.total)}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <p className="font-bold text-sm mb-4">Status history</p>
            <ol className="relative">
              {[...order.statusHistory].reverse().map((h, i, arr) => (
                <li key={i} className={`relative flex gap-3 pb-4 ${i === arr.length - 1 ? 'pb-0' : ''}`}>
                  {i !== arr.length - 1 && <span className="absolute top-6 start-[9px] bottom-0 w-0.5 bg-ink/10" />}
                  <span className="h-5 w-5 rounded-full border-2 border-brand-600 bg-white mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{ORDER_STATUS_LABELS[h.status]?.en}</p>
                    <p className="text-[11px] text-ink/45">{formatDate(h.createdAt, { withTime: true })} by {h.changedByName || 'system'}{h.note ? ` — ${h.note}` : ''}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <p className="font-bold text-sm mb-3">Internal notes</p>
            {order.adminNote && <pre className="text-xs text-ink/60 whitespace-pre-wrap bg-cream rounded-xl p-3 mb-3 max-h-48 overflow-y-auto">{order.adminNote}</pre>}
            <div className="flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add internal note…" className="input !py-2 text-sm flex-1" />
              <button className="btn-primary !py-2 !px-4 text-sm" onClick={addNote}>Add</button>
            </div>
          </div>
        </div>

        <div className="grid gap-5 content-start">
          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <p className="font-bold text-sm mb-3">Customer</p>
            <p className="font-semibold text-sm">{order.customerName}</p>
            <p className="text-sm text-ink/55" dir="ltr">{order.customerPhone}</p>
            {order.customerEmail && <p className="text-sm text-ink/55">{order.customerEmail}</p>}
            {customerInfo && (
              <Link to={`/admin/customers/${customerInfo.id}`} className="text-xs font-bold text-brand-700 hover:underline mt-2 inline-block">
                View customer profile →
              </Link>
            )}
            {customerOrders.length > 0 && (
              <div className="mt-3 pt-3 border-t border-ink/8">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink/40 mb-1.5">Previous orders</p>
                {customerOrders.slice(0, 5).map((o) => (
                  <p key={o.orderNumber} className="text-[11px] text-ink/55 flex justify-between">
                    <span dir="ltr">{o.orderNumber}</span>
                    <span>{ORDER_STATUS_LABELS[o.status]?.en} • {aed(o.total, { compact: true })}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
            <p className="font-bold text-sm mb-3">Delivery</p>
            <div className="grid gap-1 text-sm">
              <p className="font-semibold">{order.emirate} — {order.area}</p>
              <p>{order.address}</p>
              {order.building && <p>Building: {order.building}</p>}
              {order.apartment && <p>Apartment: {order.apartment}</p>}
              {order.landmark && <p className="text-ink/55">Landmark: {order.landmark}</p>}
              {order.notes && <p className="text-xs bg-gold-50 rounded-lg p-2 mt-1 text-gold-800">📝 {order.notes}</p>}
            </div>
            <div className="mt-4 grid gap-2">
              <input defaultValue={order.courierName || ''} onBlur={(e) => e.target.value !== order.courierName && saveDetails({ courierName: e.target.value })} placeholder="Courier name" className="input !py-2 text-sm" />
              <input defaultValue={order.trackingNumber || ''} onBlur={(e) => e.target.value !== order.trackingNumber && saveDetails({ trackingNumber: e.target.value })} placeholder="Tracking number" className="input !py-2 text-sm" dir="ltr" />
              <p className="text-[11px] text-ink/40">Estimated: {order.deliveryEstimate || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      <Modal open={!!waMessage} onClose={() => setWaMessage(null)} title="WhatsApp message template">
        <p className="text-xs text-ink/45 mb-3">Copy this message and send it to the customer on WhatsApp.</p>
        <pre className="bg-cream rounded-xl p-4 text-sm whitespace-pre-wrap">{waMessage}</pre>
        {customerInfo && (
          <a
            className="btn-primary w-full !py-2.5 mt-4"
            href={`https://wa.me/${order.customerPhone}?text=${encodeURIComponent(waMessage || '')}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={16} /> Open in WhatsApp
          </a>
        )}
      </Modal>
    </div>
  );
}
