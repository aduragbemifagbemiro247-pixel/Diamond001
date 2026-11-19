import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../types/store';
import { useStore } from '../../context/StoreContext';
import { useAdminAuth } from '../../context/AdminAuthContext';

interface StaffRow {
  id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'store_manager' | 'product_manager' | 'order_manager' | 'content_manager';
  is_active: boolean;
  permissions: string[];
  created_at: string;
}

export const AdminStaffPage: React.FC = () => {
  const { admin } = useAdminAuth();
  const { notify } = useStore();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissionsList, setPermissionsList] = useState<string[]>([]);
  const [defaultPerms, setDefaultPerms] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'store_manager',
    permissions: [] as string[],
  });

  const load = () => {
    apiFetch<{
      staff: StaffRow[];
      available_roles: string[];
      available_permissions: string[];
      default_role_permissions: Record<string, string[]>;
    }>('/api/admin/staff')
      .then((res) => {
        setStaff(res.staff);
        setRoles(res.available_roles);
        setPermissionsList(res.available_permissions);
        setDefaultPerms(res.default_role_permissions);
        setForm((prev) => ({
          ...prev,
          permissions: res.default_role_permissions[prev.role] || [],
        }));
      })
      .catch((err) => notify(err instanceof Error ? err.message : 'Super Admin access required.', 'error'));
  };

  useEffect(() => {
    if (admin?.role === 'super_admin') load();
  }, [admin]);

  if (admin?.role !== 'super_admin') {
    return (
      <div className="bg-[#FFFFFF] border border-[#101820]/10 p-8 text-sm text-red-700">
        Only the Super Admin can access staff creation and permission controls.
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      notify('Staff account created.', 'success');
      setForm({
        full_name: '',
        email: '',
        password: '',
        role: 'store_manager',
        permissions: defaultPerms['store_manager'] || [],
      });
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to create staff account.', 'error');
    }
  };

  const toggleActive = async (member: StaffRow) => {
    try {
      await apiFetch(`/api/admin/staff/${member.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !member.is_active }),
      });
      notify(`Account ${member.is_active ? 'deactivated' : 'reactivated'}.`, 'info');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">Staff &amp; Role Permissions</h1>
        <p className="text-xs text-[#707782] mt-1">
          Super Admin control over staff accounts, role assignments, and backend-enforced permissions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form onSubmit={handleCreate} className="lg:col-span-5 bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
          <h2 className="font-serif text-lg font-semibold">Add Staff Member</h2>
          <input
            type="text"
            required
            placeholder="Full Name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
          />
          <input
            type="email"
            required
            placeholder="Staff Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
          />
          <input
            type="password"
            required
            minLength={10}
            placeholder="Temporary Password (min 10 chars)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
          />
          <div>
            <label className="block text-xs font-medium mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => {
                const role = e.target.value;
                setForm({ ...form, role, permissions: defaultPerms[role] || [] });
              }}
              className="w-full border border-[#101820]/20 px-3 py-2 text-sm bg-[#FFFFFF]"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2">Permissions</label>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {permissionsList.map((p) => (
                <label key={p} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.role === 'super_admin' || form.permissions.includes(p)}
                    disabled={form.role === 'super_admin'}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...form.permissions, p]
                        : form.permissions.filter((item) => item !== p);
                      setForm({ ...form, permissions: next });
                    }}
                  />
                  <span className="capitalize">{p.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="w-full py-2.5 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider">
            Create Staff Account
          </button>
        </form>

        <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#101820]/10 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#101820]/10 text-[#707782] bg-[#F7F5F0]/60">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#101820]/5">
              {staff.map((m) => (
                <tr key={m.id}>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-[#101820]">{m.full_name}</p>
                    <p className="text-[#707782]">{m.email}</p>
                  </td>
                  <td className="py-3 px-4 capitalize">{m.role.replace(/_/g, ' ')}</td>
                  <td className="py-3 px-4">{m.is_active ? 'Active' : 'Deactivated'}</td>
                  <td className="py-3 px-4 text-right">
                    {m.id !== admin.id && (
                      <button
                        type="button"
                        onClick={() => toggleActive(m)}
                        className="px-3 py-1 border border-[#101820]/20 hover:bg-[#101820] hover:text-[#FFFFFF]"
                      >
                        {m.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
