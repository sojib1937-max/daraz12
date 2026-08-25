// App shell: routes for storefront + admin. Admin route base is configurable
// via VITE_ADMIN_PATH (default /admin). Route protection happens in AdminApp.
import { Route, Routes } from 'react-router-dom';
import { useSite, useAuth } from './store';
import { api } from './lib/api';
import { useEffect } from 'react';
import { StorefrontLayout } from './components/storefront/StorefrontLayout';
import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { ProductDetail } from './pages/ProductDetail';
import { CategoryPage } from './pages/CategoryPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderSuccess } from './pages/OrderSuccess';
import { TrackingPage } from './pages/TrackingPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { FaqPage } from './pages/FaqPage';
import { StaticPolicyPage } from './pages/StaticPolicyPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AccountPage } from './pages/AccountPage';
import { WishlistPage } from './pages/WishlistPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AdminApp } from './admin/AdminApp';

const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || '/admin';

export function App() {
  const { setSettings } = useSite();
  const { setCustomer } = useAuth();

  useEffect(() => {
    // Restore customer session on page load (login state survives refresh)
    api
      .get<{ id: number; name: string; phone: string; email: string | null } | null>('/api/auth/me')
      .then((c) => {
        if (c) setCustomer(c);
      })
      .catch(() => undefined);
    // Warm the public settings + track a page view for analytics
    api
      .get<Record<string, unknown>>('/api/settings/public')
      .then((s) => setSettings(s as never))
      .catch(() => undefined);
    api
      .post('/api/analytics/event', { type: 'PAGE_VIEW' })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Routes>
      {/* Admin panel (configurable base path) */}
      <Route path={`${ADMIN_PATH}/*`} element={<AdminApp />} />

      {/* Storefront */}
      <Route element={<StorefrontLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/product/:slug" element={<ProductDetail />} />
        <Route path="/category/:slug" element={<CategoryPage />} />
        <Route path="/search" element={<Shop />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-success/:orderNumber" element={<OrderSuccess />} />
        <Route path="/track-order" element={<TrackingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/shipping-policy" element={<StaticPolicyPage page="shipping" />} />
        <Route path="/return-policy" element={<StaticPolicyPage page="returns" />} />
        <Route path="/privacy-policy" element={<StaticPolicyPage page="privacy" />} />
        <Route path="/terms" element={<StaticPolicyPage page="terms" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
