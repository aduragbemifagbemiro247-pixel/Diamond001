import React, { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  CreditCard,
  FileEdit,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Tag,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { apiFetch } from '../../types/store';

interface AdminNavItem {
  to: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  perm?: string;
  superAdminOnly?: boolean;
}

const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/products', label: 'Products', icon: Package, perm: 'products' },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree, perm: 'categories' },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart, perm: 'orders' },
  { to: '/admin/deliveries', label: 'Deliveries', icon: Truck, perm: 'deliveries' },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard, perm: 'payments' },
  { to: '/admin/customers', label: 'Customers', icon: Users, perm: 'customers' },
  { to: '/admin/coupons', label: 'Coupons', icon: Tag, perm: 'coupons' },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3, perm: 'reports' },
  { to: '/admin/content', label: 'Website Content', icon: FileEdit, perm: 'content' },
  { to: '/admin/staff', label: 'Staff & Roles', icon: Shield, superAdminOnly: true },
  { to: '/admin/settings', label: 'Settings', icon: Settings, perm: 'settings' },
  { to: '/admin/activity-logs', label: 'Activity Logs', icon: Activity, perm: 'activity_logs' },
];

export const AdminLayout: React.FC = () => {
  const { admin, loading, logoutAdmin, hasPermission } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    { id: string; title: string; message: string; is_read: number; created_at: string }[]
  >([]);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    if (!admin) return;
    apiFetch<{ notifications: typeof notifications }>('/api/admin/notifications')
      .then((res) => setNotifications(res.notifications))
      .catch(() => {});
  }, [admin, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center text-sm text-[#707782]">
        Validating staff session...
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const visibleNav = ADMIN_NAV.filter((item) => {
    if (item.superAdminOnly) return admin.role === 'super_admin';
    if (item.perm) return hasPermission(item.perm);
    return true;
  });

  const handleMarkRead = async () => {
    await apiFetch('/api/admin/notifications/mark-read', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  };

  const handleLogout = async () => {
    await logoutAdmin();
    navigate('/admin/login');
  };

  const currentNav = ADMIN_NAV.find((n) => location.pathname.startsWith(n.to));

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#101820] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-[#101820] text-[#F7F5F0] shrink-0 no-print">
        <div className="h-16 px-6 flex items-center border-b border-[#F7F5F0]/10">
          <Link to="/admin/dashboard" className="font-serif text-base tracking-[0.16em] text-[#FFFFFF]">
            DIAMOND STORE
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#D6B875] text-[#101820] font-semibold'
                    : 'text-[#F7F5F0]/75 hover:bg-[#FFFFFF]/5 hover:text-[#FFFFFF]'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[#F7F5F0]/10 text-xs space-y-3">
          <div>
            <p className="font-semibold text-[#FFFFFF] truncate">{admin.full_name}</p>
            <p className="text-[#D6B875] capitalize">{admin.role.replace(/_/g, ' ')}</p>
          </div>
          <div className="flex items-center justify-between pt-1">
            <Link to="/" className="text-[#F7F5F0]/70 hover:text-[#FFFFFF] underline">
              View Storefront
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 text-[#F7F5F0]/70 hover:text-[#D6B875]"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div className="w-64 bg-[#101820] text-[#F7F5F0] flex flex-col h-full">
            <div className="h-16 px-5 flex items-center justify-between border-b border-[#F7F5F0]/10">
              <span className="font-serif text-sm tracking-[0.14em] text-[#FFFFFF]">DIAMOND STORE</span>
              <button type="button" onClick={() => setSidebarOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {visibleNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 text-xs font-medium ${
                      isActive ? 'bg-[#D6B875] text-[#101820] font-semibold' : 'text-[#F7F5F0]/80'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-[#F7F5F0]/10 text-xs flex justify-between">
              <Link to="/" onClick={() => setSidebarOpen(false)} className="underline">
                Storefront
              </Link>
              <button type="button" onClick={handleLogout} className="text-[#D6B875]">
                Sign Out
              </button>
            </div>
          </div>
          <div className="flex-1 bg-[#101820]/50" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-[#FFFFFF] border-b border-[#101820]/10 px-4 sm:px-8 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open admin menu"
              className="lg:hidden p-2 -ml-2 text-[#101820]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs text-[#707782] truncate">
              <span>Admin</span>
              <span className="mx-2">/</span>
              <span className="font-semibold text-[#101820]">{currentNav?.label || 'Workspace'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 relative shrink-0">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Admin notifications"
              className="relative p-2 border border-[#101820]/15 hover:border-[#101820] text-[#101820]"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#101820] text-[#D6B875] text-[10px] font-semibold px-1.5 tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 bg-[#FFFFFF] border border-[#101820]/20 shadow-lg z-40 p-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#101820]/10">
                  <span className="text-xs font-semibold uppercase tracking-wider">Notifications</span>
                  <button type="button" onClick={handleMarkRead} className="text-[11px] text-[#B5954F] hover:underline">
                    Mark all read
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-[#101820]/5">
                  {notifications.length === 0 ? (
                    <p className="py-4 text-xs text-[#707782]">No notifications.</p>
                  ) : (
                    notifications.slice(0, 12).map((n) => (
                      <div key={n.id} className={`py-2.5 text-xs ${n.is_read ? 'opacity-65' : ''}`}>
                        <p className="font-semibold text-[#101820]">{n.title}</p>
                        <p className="text-[#707782] mt-0.5">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
