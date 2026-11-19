import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AdminUser, apiFetch } from '../types/store';

interface AdminAuthContextValue {
  admin: AdminUser | null;
  loading: boolean;
  refreshAdmin: () => Promise<AdminUser | null>;
  logoutAdmin: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAdmin = useCallback(async (): Promise<AdminUser | null> => {
    try {
      const data = await apiFetch<{ admin: AdminUser | null }>('/api/admin/me');
      setAdmin(data.admin);
      return data.admin;
    } catch {
      setAdmin(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAdmin();
  }, [refreshAdmin]);

  const logoutAdmin = useCallback(async () => {
    await apiFetch('/api/admin/logout', { method: 'POST' });
    setAdmin(null);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!admin) return false;
      if (admin.role === 'super_admin') return true;
      return admin.permissions.includes(permission);
    },
    [admin]
  );

  return (
    <AdminAuthContext.Provider value={{ admin, loading, refreshAdmin, logoutAdmin, hasPermission }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
