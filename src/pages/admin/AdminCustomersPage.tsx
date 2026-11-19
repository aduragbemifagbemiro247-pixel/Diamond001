import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { apiFetch, formatNGN } from '../../types/store';
import { useStore } from '../../context/StoreContext';

interface CustomerRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  whatsapp_number: string | null;
  status: 'active' | 'suspended';
  order_count: number;
  total_spent_kobo: number;
  created_at: string;
}

export const AdminCustomersPage: React.FC = () => {
  const { notify } = useStore();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState('');

  const load = () => {
    apiFetch<{ customers: CustomerRow[] }>(`/api/admin/customers?search=${encodeURIComponent(search)}`)
      .then((res) => setCustomers(res.customers))
      .catch((err) => notify(err instanceof Error ? err.message : 'Unable to load customers.', 'error'));
  };

  useEffect(() => {
    load();
  }, [search]);

  const toggleStatus = async (c: CustomerRow) => {
    const next = c.status === 'active' ? 'suspended' : 'active';
    await apiFetch(`/api/admin/customers/${c.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: next }),
    });
    notify(`Customer ${c.full_name} marked as ${next}.`, 'info');
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">Customers</h1>
        <p className="text-xs text-[#707782] mt-1">Customer directory, purchase totals, and account status management.</p>
      </div>

      <div className="bg-[#FFFFFF] border border-[#101820]/10 p-4 flex items-center gap-3">
        <Search className="w-4 h-4 text-[#707782]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer by name, email, or phone..."
          className="flex-1 text-sm focus:outline-none"
        />
      </div>

      <div className="bg-[#FFFFFF] border border-[#101820]/10 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#101820]/10 text-[#707782] bg-[#F7F5F0]/60">
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Phone</th>
              <th className="py-3 px-4">Orders</th>
              <th className="py-3 px-4">Collected Spend</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#101820]/5">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#707782]">No customers found.</td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-[#101820]">{c.full_name}</p>
                    <p className="text-[#707782]">{c.email}</p>
                  </td>
                  <td className="py-3 px-4 tabular-nums">{c.phone || '—'}</td>
                  <td className="py-3 px-4 tabular-nums">{c.order_count}</td>
                  <td className="py-3 px-4 tabular-nums font-semibold">{formatNGN(c.total_spent_kobo)}</td>
                  <td className="py-3 px-4 capitalize">{c.status}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => toggleStatus(c)}
                      className="px-3 py-1.5 border border-[#101820]/20 hover:bg-[#101820] hover:text-[#FFFFFF]"
                    >
                      {c.status === 'active' ? 'Suspend' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
