// Admin dashboard: KPI cards, revenue/orders charts, top products, recent orders.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Wallet, ShoppingCart, Users, Package, AlertTriangle, Banknote, TrendingUp, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, StatCard } from './ui';
import { Badge } from '../components/ui';
import { aed, formatDate, ORDER_STATUS_LABELS } from '../lib/format';

interface Summary {
  cards: {
    todaySales: number; todayOrders: number; yesterdaySales: number; salesChangePercent: number | null;
    pendingOrders: number; confirmedOrders: number; deliveredOrders: number; cancelledOrders: number;
    totalCustomers: number; totalProducts: number; lowStockCount: number; codRevenue: number;
    totalRevenue: number; profitEstimate: number;
  };
  funnel: { visitors: number; productViews: number; addToCart: number; checkoutStarted: number; ordersPlaced: number; delivered: number; conversionRate: number; averageOrderValue: number };
  topProducts: { productId: number; title: string; slug: string; image: string; stock: number; quantity: number; revenue: number }[];
  recentOrders: { id: number; orderNumber: string; customerName: string; emirate: string; total: number; status: string; isDemo: boolean; placedAt: string; itemCount: number }[];
}

const RANGES = [
  { v: 'today', l: 'Today' },
  { v: 'yesterday', l: 'Yesterday' },
  { v: '7d', l: 'Last 7 days' },
  { v: '30d', l: 'Last 30 days' },
  { v: 'month', l: 'This month' },
];

export function Dashboard() {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState<Summary | null>(null);
  const [chart, setChart] = useState<{ series: { date: string; revenue: number; orders: number }[]; byStatus: { status: string; count: number }[] } | null>(null);

  useEffect(() => {
    setData(null);
    api.get<Summary>(`/api/admin/dashboard/summary?range=${range}`).then(setData).catch(() => setData(null));
    api
      .get<{ series: { date: string; revenue: number; orders: number }[]; byStatus: { status: string; count: number }[] }>(`/api/admin/dashboard/charts?range=${range}`)
      .then(setChart)
      .catch(() => undefined);
  }, [range]);

  const c = data?.cards;
  const funnel = data?.funnel;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Your store at a glance"
        actions={
          <select value={range} onChange={(e) => setRange(e.target.value)} className="input !w-auto !py-2 text-sm" aria-label="Date range">
            {RANGES.map((r) => (
              <option key={r.v} value={r.v}>{r.l}</option>
            ))}
          </select>
        }
      />

      {!data || !c ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl skeleton" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <StatCard
              label="Today's Sales"
              value={aed(c.todaySales, { compact: true })}
              sub={
                c.salesChangePercent != null ? (
                  <span className={`inline-flex items-center gap-1 ${c.salesChangePercent >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {c.salesChangePercent >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(c.salesChangePercent)}% vs yesterday
                  </span>
                ) : 'vs yesterday: —'
              }
              icon={<Wallet size={19} />}
            />
            <StatCard label="Today's Orders" value={c.todayOrders} sub={`${c.pendingOrders} pending approval`} icon={<ShoppingCart size={19} />} tone="blue" />
            <StatCard label="Total Revenue (range)" value={aed(c.totalRevenue, { compact: true })} sub={`COD collected: ${aed(c.codRevenue, { compact: true })}`} icon={<TrendingUp size={19} />} tone="green" />
            <StatCard label="Profit Estimate" value={aed(c.profitEstimate, { compact: true })} sub="Based on cost prices" icon={<Banknote size={19} />} tone="gold" />
            <StatCard label="Customers" value={c.totalCustomers} sub="Registered + guest" icon={<Users size={19} />} tone="violet" />
            <StatCard label="Products" value={c.totalProducts} sub={`${c.lowStockCount} low/out of stock`} icon={<Package size={19} />} />
            {c.lowStockCount > 0 && (
              <StatCard label="⚠ Low Stock" value={c.lowStockCount} sub="Needs reordering" icon={<AlertTriangle size={19} />} tone="red" />
            )}
            <StatCard label="Delivered / Cancelled" value={`${c.deliveredOrders} / ${c.cancelledOrders}`} sub="All time (range)" icon={<ShoppingCart size={19} />} tone="green" />
          </div>

          {funnel && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4">
              {[
                { l: 'Visitors', v: funnel.visitors },
                { l: 'Product views', v: funnel.productViews },
                { l: 'Add to cart', v: funnel.addToCart },
                { l: 'Checkout started', v: funnel.checkoutStarted },
                { l: 'Orders placed', v: funnel.ordersPlaced },
                { l: 'Conversion', v: `${funnel.conversionRate}%` },
              ].map((f) => (
                <div key={f.l} className="bg-white rounded-xl border border-ink/5 shadow-card p-3 text-center">
                  <p className="text-lg font-extrabold">{f.v}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink/40">{f.l}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-4 mt-4">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-ink/5 shadow-card p-5">
              <p className="font-bold text-sm mb-4">Revenue</p>
              {chart?.series?.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chart.series}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f5132" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#0f5132" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip formatter={(v) => [aed(Number(v)), 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="#0f5132" strokeWidth={2.5} fill="url(#rev)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] skeleton" />
              )}
            </div>
            <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
              <p className="font-bold text-sm mb-4">Orders by status</p>
              {chart?.byStatus?.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={chart.byStatus} dataKey="count" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {chart.byStatus.map((s, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend formatter={(v) => ORDER_STATUS_LABELS[String(v)]?.en || v} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] skeleton" />
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mt-4">
            <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
              <p className="font-bold text-sm mb-4">Top products</p>
              {data.topProducts.length === 0 ? (
                <p className="text-sm text-ink/40 py-8 text-center">No sales in this range</p>
              ) : (
                <div className="grid gap-2.5">
                  {data.topProducts.slice(0, 6).map((p, i) => (
                    <Link key={p.productId} to={`/admin/products/${p.productId}/edit`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-brand-50/50">
                      <span className="w-5 text-sm font-extrabold text-ink/30">{i + 1}</span>
                      {p.image ? <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover bg-cream" /> : <span className="h-10 w-10 rounded-lg bg-cream" />}
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold truncate">{p.title}</span>
                        <span className="block text-[11px] text-ink/45">{p.quantity} sold • stock {p.stock}</span>
                      </span>
                      <span className="text-[13px] font-extrabold text-brand-800">{aed(p.revenue, { compact: true })}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold text-sm">Recent orders</p>
                <Link to="/admin/orders" className="text-xs font-bold text-brand-700 hover:underline">View all →</Link>
              </div>
              <div className="grid gap-2">
                {data.recentOrders.slice(0, 6).map((o) => (
                  <Link key={o.id} to={`/admin/orders/${o.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-brand-50/50">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-brand-800 truncate" dir="ltr">{o.orderNumber}</p>
                      <p className="text-[11px] text-ink/45 truncate">
                        {o.customerName} • {o.itemCount} item{o.itemCount > 1 ? 's' : ''} • {formatDate(o.placedAt)}
                      </p>
                    </div>
                    <Badge color={ORDER_STATUS_LABELS[o.status]?.color}>{ORDER_STATUS_LABELS[o.status]?.en}</Badge>
                    <span className="text-[13px] font-extrabold w-20 text-end">{aed(o.total, { compact: true })}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const PIE_COLORS = ['#0f5132', '#3a8a5e', '#c8a24b', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#f97316', '#10b981', '#64748b', '#e11d48'];
