// Global store state: public settings, toasts, cart (persisted), auth.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, PublicSettings } from '../lib/types';

// ---------------- Public settings + site data (fetched once) ----------------
interface SiteState {
  settings: PublicSettings | null;
  home: Record<string, unknown> | null;
  setSettings: (s: PublicSettings) => void;
  setHome: (h: Record<string, unknown>) => void;
}
export const useSite = create<SiteState>((set) => ({
  settings: null,
  home: null,
  setSettings: (settings) => set({ settings }),
  setHome: (home) => set({ home }),
}));

// ---------------- Toasts ----------------
export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}
interface ToastState {
  toasts: Toast[];
  push: (kind: Toast['kind'], message: string) => void;
  dismiss: (id: number) => void;
}
let toastId = 0;
export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, message) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, kind, message }] });
    setTimeout(() => get().dismiss(id), 4200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  success: (m: string) => useToast.getState().push('success', m),
  error: (m: string) => useToast.getState().push('error', m),
  info: (m: string) => useToast.getState().push('info', m),
};

// ---------------- Cart (persisted; synced to server for abandoned-cart tracking) ----------------
interface CartState {
  items: CartItem[];
  couponCode: string | null;
  couponDiscount: number;
  guestId: string;
  add: (item: CartItem) => void;
  remove: (productId: number, variantId?: number | null) => void;
  setQty: (productId: number, qty: number, variantId?: number | null) => void;
  clear: () => void;
  setCoupon: (code: string | null, discount?: number) => void;
  setGuestId: (id: string) => void;
  setItems: (items: CartItem[]) => void;
  count: () => number;
  subtotal: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: null,
      couponDiscount: 0,
      guestId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `g-${Date.now()}`,
      add: (item) => {
        const items = [...get().items];
        const idx = items.findIndex((i) => i.productId === item.productId && (i.variantId ?? null) === (item.variantId ?? null));
        if (idx >= 0) {
          items[idx] = { ...items[idx], quantity: Math.min(50, items[idx].quantity + item.quantity) };
        } else {
          items.push(item);
        }
        set({ items });
      },
      remove: (productId, variantId) =>
        set({ items: get().items.filter((i) => !(i.productId === productId && (i.variantId ?? null) === (variantId ?? null))) }),
      setQty: (productId, qty, variantId) =>
        set({
          items: get()
            .items.map((i) => (i.productId === productId && (i.variantId ?? null) === (variantId ?? null) ? { ...i, quantity: Math.max(1, Math.min(50, qty)) } : i))
            .filter((i) => i.quantity > 0),
        }),
      clear: () => set({ items: [], couponCode: null, couponDiscount: 0 }),
      setCoupon: (code, discount = 0) => set({ couponCode: code, couponDiscount: discount }),
      setGuestId: (id) => set({ guestId: id }),
      setItems: (items) => set({ items }),
      count: () => get().items.reduce((a, i) => a + i.quantity, 0),
      subtotal: () => get().items.reduce((a, i) => a + i.price * i.quantity, 0),
    }),
    { name: 'dc_cart' }
  )
);

// ---------------- Customer auth ----------------
interface AuthState {
  customer: { id: number; name: string; phone: string; email: string | null } | null;
  admin: { id: number; name: string; email: string; role: string; totpEnabled: boolean } | null;
  setCustomer: (c: AuthState['customer']) => void;
  setAdmin: (a: AuthState['admin']) => void;
}
export const useAuth = create<AuthState>((set) => ({
  customer: null,
  admin: null,
  setCustomer: (customer) => set({ customer }),
  setAdmin: (admin) => set({ admin }),
}));

// ---------------- UI state ----------------
interface UiState {
  mobileNavOpen: boolean;
  cartDrawerOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
  setCartDrawerOpen: (v: boolean) => void;
}
export const useUi = create<UiState>((set) => ({
  mobileNavOpen: false,
  cartDrawerOpen: false,
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setCartDrawerOpen: (cartDrawerOpen) => set({ cartDrawerOpen }),
}));
