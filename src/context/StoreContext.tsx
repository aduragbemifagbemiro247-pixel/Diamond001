import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CartItem, CustomerUser, StorefrontData, apiFetch } from '../types/store';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface StoreContextValue {
  storefront: StorefrontData | null;
  loadingStorefront: boolean;
  refreshStorefront: () => Promise<void>;
  customer: CustomerUser | null;
  loadingCustomer: boolean;
  refreshCustomer: () => Promise<void>;
  logoutCustomer: () => Promise<void>;
  cart: CartItem[];
  cartCount: number;
  cartSubtotalKobo: number;
  addToCart: (item: CartItem) => void;
  updateCartQuantity: (variantId: string, quantity: number) => void;
  removeFromCart: (variantId: string) => void;
  clearCart: () => void;
  appliedCoupon: { code: string; discount_kobo: number } | null;
  setAppliedCoupon: (coupon: { code: string; discount_kobo: number } | null) => void;
  toasts: ToastMessage[];
  notify: (text: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);
const CART_STORAGE_KEY = 'diamond_store_cart_v1';

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storefront, setStorefront] = useState<StorefrontData | null>(null);
  const [loadingStorefront, setLoadingStorefront] = useState(true);
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_kobo: number } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (text: string, type: 'success' | 'error' | 'info' = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, text }]);
      setTimeout(() => dismissToast(id), 4500);
    },
    [dismissToast]
  );

  const refreshStorefront = useCallback(async () => {
    try {
      const data = await apiFetch<StorefrontData>('/api/storefront');
      setStorefront(data);
    } catch {
      // keep existing if temporary error
    } finally {
      setLoadingStorefront(false);
    }
  }, []);

  const refreshCustomer = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: CustomerUser | null }>('/api/auth/me');
      setCustomer(data.user);
    } catch {
      setCustomer(null);
    } finally {
      setLoadingCustomer(false);
    }
  }, []);

  useEffect(() => {
    refreshStorefront();
    refreshCustomer();
  }, [refreshStorefront, refreshCustomer]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage quota errors
    }
  }, [cart]);

  const logoutCustomer = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setCustomer(null);
    notify('Signed out of your customer account.', 'info');
  }, [notify]);

  const addToCart = useCallback(
    (incoming: CartItem) => {
      setCart((prev) => {
        const existing = prev.find((i) => i.variantId === incoming.variantId);
        if (existing) {
          const nextQty = Math.min(incoming.maxStock, existing.quantity + incoming.quantity);
          return prev.map((i) =>
            i.variantId === incoming.variantId
              ? { ...i, quantity: nextQty, maxStock: incoming.maxStock, unitPriceKobo: incoming.unitPriceKobo }
              : i
          );
        }
        return [...prev, { ...incoming, quantity: Math.min(incoming.maxStock, incoming.quantity) }];
      });
      notify(`${incoming.productName} (${incoming.color} · ${incoming.size}) added to your bag.`, 'success');
    },
    [notify]
  );

  const updateCartQuantity = useCallback((variantId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.variantId !== variantId));
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(i.maxStock, quantity) } : i))
    );
  }, []);

  const removeFromCart = useCallback((variantId: string) => {
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setAppliedCoupon(null);
  }, []);

  const cartCount = useMemo(() => cart.reduce((sum, i) => sum + i.quantity, 0), [cart]);
  const cartSubtotalKobo = useMemo(
    () => cart.reduce((sum, i) => sum + i.unitPriceKobo * i.quantity, 0),
    [cart]
  );

  return (
    <StoreContext.Provider
      value={{
        storefront,
        loadingStorefront,
        refreshStorefront,
        customer,
        loadingCustomer,
        refreshCustomer,
        logoutCustomer,
        cart,
        cartCount,
        cartSubtotalKobo,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        appliedCoupon,
        setAppliedCoupon,
        toasts,
        notify,
        dismissToast,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
