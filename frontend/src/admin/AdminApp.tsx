// Admin panel: route guard, layout (sidebar + topbar), real-time notifications.
import React, { useEffect, useState } from 'react';
import { create } from 'zustand';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Tags, TicketPercent, Zap, Star,
  Image as ImageIcon, LayoutTemplate, Settings, ShieldCheck, ScrollText, BarChart3,
  Bell, LogOut, Menu, X, Store,
} from 'lucide-react';
import { api, sessionTokens } from '../lib/api';
import { useAuth } from '../store';
import { AdminLogin } from './AdminLogin';
import { Dashboard } from './Dashboard';
import { Products, ProductForm } from './Products';
import { Orders, OrderDetail } from './Orders';
import { Customers, CustomerDetail } from './Customers';
import { Categories } from './Categories';
import { Coupons, FlashSales } from './Marketing';
import { Reviews, Media } from './Content';
import { Homepage } from './Homepage';
import { SettingsPage } from './SettingsPage';
import { UsersPage, AuditPage, AnalyticsPage } from './System';
import { Toasts } from '../components/ui';
import { NotificationCenter } from './Notifications';

export const useAdminSidebar = create<{ open: boolean; toggle: () => void; close: () => void }>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false }),
}));

interface AdminMe {
  id: number;
  name: string;
  email: string;
  role: string;
  totpEnabled: boolean;
  mustChangePassword: boolean;
  demoMode: boolean;
}

export function AdminApp() {
  const { admin, setAdmin } = useAuth();
  const [me, setMe] = useState<AdminMe | null>(admin as AdminMe | null);
  const [checking, setChecking] = useState(!admin);

  useEffect(() => {
    if (admin) {
      // Login succeeded — sync the UI immediately (fixes "stuck on login screen")
      setMe(admin as AdminMe);
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    api
      .get<AdminMe>('/api/admin/auth/me')
      .then((d) => {
        if (!cancelled) {
          setAdmin(d as never);
          setMe(d);
        }
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [admin, setAdmin]);

  if (checking) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-2xl bg-brand-700 text-gold-400 font-extrabold text-xl flex items-center justify-center mx-auto mb-4 animate-pulse">V</div>
          <p className="text-sm text-ink/40">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  if (!me) return <AdminLogin />;

  return (
    <div className="min-h-screen bg-[#f4f5f7] lg:flex">
      <Sidebar me={me} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar me={me} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/:id/edit" element={<ProductForm />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/coupons" element={<Coupons />} />
            <Route path="/flash-sales" element={<FlashSales />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/media" element={<Media />} />
            <Route path="/homepage" element={<Homepage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
      <Toasts />
    </div>
  );
}

const NAV: { to: string; label: string; icon: React.ReactNode }[] = [
  { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
  { to: '/admin/orders', label: 'Orders', icon: <ShoppingCart size={17} /> },
  { to: '/admin/products', label: 'Products', icon: <Package size={17} /> },
  { to: '/admin/customers', label: 'Customers', icon: <Users size={17} /> },
  { to: '/admin/categories', label: 'Categories & Brands', icon: <Tags size={17} /> },
  { to: '/admin/coupons', label: 'Coupons', icon: <TicketPercent size={17} /> },
  { to: '/admin/flash-sales', label: 'Flash Sales', icon: <Zap size={17} /> },
  { to: '/admin/reviews', label: 'Reviews', icon: <Star size={17} /> },
  { to: '/admin/media', label: 'Media Library', icon: <ImageIcon size={17} /> },
  { to: '/admin/homepage', label: 'Homepage Builder', icon: <LayoutTemplate size={17} /> },
  { to: '/admin/analytics', label: 'Analytics & Carts', icon: <BarChart3 size={17} /> },
  { to: '/admin/settings', label: 'Settings', icon: <Settings size={17} /> },
  { to: '/admin/users', label: 'Admin Users & Roles', icon: <ShieldCheck size={17} /> },
  { to: '/admin/audit', label: 'Audit Log', icon: <ScrollText size={17} /> },
];

const ROLE_NAV: Record<string, string[]> = {
  SUPER_ADMIN: NAV.map((n) => n.to),
  ADMIN: NAV.filter((n) => n.to !== '/admin/users').map((n) => n.to),
  MANAGER: ['/admin', '/admin/orders', '/admin/products', '/admin/customers', '/admin/categories', '/admin/coupons', '/admin/flash-sales', '/admin/reviews', '/admin/media', '/admin/homepage', '/admin/analytics', '/admin/settings'],
  ORDER_MANAGER: ['/admin', '/admin/orders', '/admin/customers', '/admin/analytics'],
  PRODUCT_MANAGER: ['/admin', '/admin/products', '/admin/categories', '/admin/media', '/admin/flash-sales'],
  VIEWER: ['/admin', '/admin/orders', '/admin/products', '/admin/customers', '/admin/settings', '/admin/audit', '/admin/analytics'],
};

function Sidebar({ me }: { me: AdminMe }) {
  const { open, close } = useAdminSidebar();
  const visibleNav = NAV.filter((n) => (ROLE_NAV[me.role] || []).includes(n.to));

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10 shrink-0">
        <span className="h-9 w-9 rounded-xl bg-gold-500 text-ink font-extrabold flex items-center justify-center">V</span>
        <div>
          <p className="font-extrabold text-white leading-none">Virexamart</p>
          <p className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Admin Panel</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 grid gap-0.5 content-start">
        {visibleNav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/admin'}
            onClick={close}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive ? 'bg-gold-500 text-ink shadow-card' : 'text-white/65 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {n.icon} {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-white/10">
        <NavLink to="/" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-white/65 hover:bg-white/10 hover:text-white">
          <Store size={17} /> View Storefront
        </NavLink>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 bg-brand-900 sticky top-0 h-screen">{content}</aside>
      {open && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={close} />
          <div className="absolute inset-y-0 start-0 w-72 bg-brand-900 shadow-2xl animate-slide-in-left">
            <button className="absolute top-4 end-3 p-2 text-white/60" onClick={close} aria-label="Close menu">
              <X size={18} />
            </button>
            {content}
          </div>
        </div>
      )}
    </>
  );
}

function Topbar({ me }: { me: AdminMe }) {
  const navigate = useNavigate();
  const { setAdmin } = useAuth();
  const { toggle } = useAdminSidebar();
  const [menuOpen, setMenuOpen] = useState(false);

  const logout = async () => {
    try {
      await api.post('/api/admin/auth/logout');
    } catch {
      /* ignore */
    }
    sessionTokens.clearAdmin();
    setAdmin(null);
    navigate('/admin');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-ink/5 h-16 flex items-center px-4 md:px-6 gap-3">
      <button className="lg:hidden p-2 text-ink/60" onClick={toggle} aria-label="Menu">
        <Menu size={20} />
      </button>
      <div className="lg:hidden flex items-center gap-2 font-extrabold text-brand-800">
        <span className="h-8 w-8 rounded-lg bg-brand-700 text-gold-400 flex items-center justify-center text-sm">V</span>
        Virexamart
      </div>

      <div className="ms-auto flex items-center gap-2">
        <NotificationCenter />
        <div className="relative">
          <button
            className="flex items-center gap-2.5 ps-2 pe-3 py-1.5 rounded-xl hover:bg-ink/5"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Account menu"
          >
            <span className="h-8 w-8 rounded-full bg-brand-700 text-white font-bold text-xs flex items-center justify-center">
              {me.name.charAt(0)}
            </span>
            <span className="hidden sm:block text-start">
              <span className="block text-xs font-bold leading-none">{me.name}</span>
              <span className="block text-[10px] text-ink/45 mt-0.5">{me.role.replace('_', ' ')}</span>
            </span>
          </button>
          {menuOpen && (
            <div className="absolute end-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-lift border border-ink/8 p-2 z-50">
              <div className="px-3 py-2 border-b border-ink/5 mb-1">
                <p className="text-sm font-bold">{me.name}</p>
                <p className="text-xs text-ink/45 truncate">{me.email}</p>
              </div>
              {me.demoMode && (
                <p className="px-3 py-1.5 text-[11px] font-bold text-gold-700 bg-gold-50 rounded-lg mb-1">⚠️ DEMO MODE — data is demo data</p>
              )}
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
