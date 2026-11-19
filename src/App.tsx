import React from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { AnnouncementBar } from './components/layout/AnnouncementBar';
import { StoreHeader } from './components/layout/StoreHeader';
import { StoreFooter } from './components/layout/StoreFooter';
import { ToastContainer } from './components/common/ToastContainer';

import { HomePage } from './pages/public/HomePage';
import { ShopPage } from './pages/public/ShopPage';
import { ProductDetailPage } from './pages/public/ProductDetailPage';
import { CartPage } from './pages/public/CartPage';
import { CheckoutPage } from './pages/public/CheckoutPage';
import { AccountPage } from './pages/public/AccountPage';
import { TrackOrderPage } from './pages/public/TrackOrderPage';
import { ContentPage } from './pages/public/ContentPage';
import { NotFoundPage } from './pages/public/NotFoundPage';

import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminProductFormPage } from './pages/admin/AdminProductFormPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminPaymentsPage } from './pages/admin/AdminPaymentsPage';
import { AdminDeliveriesPage } from './pages/admin/AdminDeliveriesPage';
import { AdminCouponsPage } from './pages/admin/AdminCouponsPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminContentPage } from './pages/admin/AdminContentPage';
import { AdminStaffPage } from './pages/admin/AdminStaffPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminActivityLogsPage } from './pages/admin/AdminActivityLogsPage';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center p-6">
          <div className="bg-[#FFFFFF] border border-[#101820]/15 p-8 max-w-md text-center">
            <h1 className="font-serif text-2xl font-semibold text-[#101820]">Something went wrong</h1>
            <p className="mt-2 text-xs text-[#707782]">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 px-5 py-2.5 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const PublicLayout: React.FC = () => (
  <div className="min-h-screen flex flex-col bg-[#F7F5F0] text-[#101820]">
    <AnnouncementBar />
    <StoreHeader />
    <main className="flex-1">
      <Outlet />
    </main>
    <StoreFooter />
  </div>
);

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <StoreProvider>
          <AdminAuthProvider>
            <Routes>
              {/* Public Storefront Routes */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/shop" element={<ShopPage />} />
                <Route path="/category/:slug" element={<ShopPage />} />
                <Route path="/product/:slug" element={<ProductDetailPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/account/login" element={<AccountPage />} />
                <Route path="/account/register" element={<AccountPage />} />
                <Route path="/account/orders" element={<AccountPage />} />
                <Route path="/account/addresses" element={<AccountPage />} />
                <Route path="/track-order" element={<TrackOrderPage />} />
                <Route path="/about" element={<ContentPage pageKey="about" />} />
                <Route path="/contact" element={<ContentPage pageKey="contact" />} />
                <Route path="/faq" element={<ContentPage pageKey="faq" />} />
                <Route path="/shipping-policy" element={<ContentPage pageKey="shipping_policy" />} />
                <Route path="/return-policy" element={<ContentPage pageKey="return_policy" />} />
                <Route path="/privacy-policy" element={<ContentPage pageKey="privacy_policy" />} />
                <Route path="/terms" element={<ContentPage pageKey="terms" />} />
              </Route>

              {/* Admin Portal Routes */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="products" element={<AdminProductsPage />} />
                <Route path="products/new" element={<AdminProductFormPage />} />
                <Route path="products/:id/edit" element={<AdminProductFormPage />} />
                <Route path="categories" element={<AdminCategoriesPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="customers" element={<AdminCustomersPage />} />
                <Route path="payments" element={<AdminPaymentsPage />} />
                <Route path="deliveries" element={<AdminDeliveriesPage />} />
                <Route path="coupons" element={<AdminCouponsPage />} />
                <Route path="reports" element={<AdminReportsPage />} />
                <Route path="content" element={<AdminContentPage />} />
                <Route path="staff" element={<AdminStaffPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
                <Route path="activity-logs" element={<AdminActivityLogsPage />} />
              </Route>

              {/* 404 */}
              <Route element={<PublicLayout />}>
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
            <ToastContainer />
          </AdminAuthProvider>
        </StoreProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
