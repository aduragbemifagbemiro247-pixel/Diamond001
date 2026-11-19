import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { apiFetch, formatNGN } from '../../types/store';
import { useStore } from '../../context/StoreContext';

interface CouponRow {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_purchase_kobo: number;
  max_discount_kobo: number | null;
  usage_limit: number | null;
  per_customer_limit: number;
  used_count: number;
  expires_at: string | null;
  is_active: number;
}

export const AdminCouponsPage: React.FC = () => {
  const { notify } = useStore();
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [form, setForm] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '10',
    min_purchase_naira: '0',
    max_discount_naira: '',
    usage_limit: '',
    per_customer_limit: '1',
    expires_at: '',
  });

  const load = () => {
    apiFetch<{ coupons: CouponRow[] }>('/api/admin/coupons')
      .then((res) => setCoupons(res.coupons))
      .catch((err) => notify(err instanceof Error ? err.message : 'Unable to load coupons.', 'error'));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const value =
        form.discount_type === 'percentage'
          ? Math.round(Number(form.discount_value))
          : Math.round(Number(form.discount_value) * 100);

      await apiFetch('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code,
          discount_type: form.discount_type,
          discount_value: value,
          min_purchase_kobo: Math.round(Number(form.min_purchase_naira || 0) * 100),
          max_discount_kobo: form.max_discount_naira ? Math.round(Number(form.max_discount_naira) * 100) : null,
          usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
          per_customer_limit: Number(form.per_customer_limit || 1),
          expires_at: form.expires_at || null,
          is_active: true,
        }),
      });
      notify('Coupon created.', 'success');
      setForm({
        code: '',
        discount_type: 'percentage',
        discount_value: '10',
        min_purchase_naira: '0',
        max_discount_naira: '',
        usage_limit: '',
        per_customer_limit: '1',
        expires_at: '',
      });
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to create coupon.', 'error');
    }
  };

  const toggleActive = async (c: CouponRow) => {
    await apiFetch(`/api/admin/coupons/${c.id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: !c.is_active }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">Coupons &amp; Discounts</h1>
        <p className="text-xs text-[#707782] mt-1">Server-validated percentage and fixed-amount promotional codes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form onSubmit={handleCreate} className="lg:col-span-4 bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
          <h2 className="font-serif text-lg font-semibold">Create Coupon</h2>
          <div>
            <label className="block text-xs font-medium mb-1">Coupon Code *</label>
            <input
              type="text"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="e.g. WELCOME10"
              className="w-full border border-[#101820]/20 px-3 py-2 text-xs font-mono uppercase"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Type</label>
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })}
                className="w-full border border-[#101820]/20 px-3 py-2 text-xs bg-[#FFFFFF]"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₦)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Value ({form.discount_type === 'percentage' ? '%' : '₦'})
              </label>
              <input
                type="number"
                required
                min={1}
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                className="w-full border border-[#101820]/20 px-3 py-2 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Min Purchase (₦)</label>
              <input
                type="number"
                min={0}
                value={form.min_purchase_naira}
                onChange={(e) => setForm({ ...form, min_purchase_naira: e.target.value })}
                className="w-full border border-[#101820]/20 px-3 py-2 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Max Discount (₦)</label>
              <input
                type="number"
                min={0}
                value={form.max_discount_naira}
                onChange={(e) => setForm({ ...form, max_discount_naira: e.target.value })}
                className="w-full border border-[#101820]/20 px-3 py-2 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Usage Limit</label>
              <input
                type="number"
                min={1}
                value={form.usage_limit}
                onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                className="w-full border border-[#101820]/20 px-3 py-2 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Per Customer Limit</label>
              <input
                type="number"
                min={1}
                value={form.per_customer_limit}
                onChange={(e) => setForm({ ...form, per_customer_limit: e.target.value })}
                className="w-full border border-[#101820]/20 px-3 py-2 text-xs tabular-nums"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Expiry Date (Optional)</label>
            <input
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className="w-full border border-[#101820]/20 px-3 py-2 text-xs"
            />
          </div>
          <button type="submit" className="w-full py-2.5 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider">
            Create Coupon
          </button>
        </form>

        <div className="lg:col-span-8 bg-[#FFFFFF] border border-[#101820]/10 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#101820]/10 text-[#707782] bg-[#F7F5F0]/60">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Discount</th>
                <th className="py-3 px-4">Min Spend</th>
                <th className="py-3 px-4">Usage</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#101820]/5">
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 px-4 font-mono font-semibold">{c.code}</td>
                  <td className="py-3 px-4 tabular-nums">
                    {c.discount_type === 'percentage' ? `${c.discount_value}%` : formatNGN(c.discount_value)}
                  </td>
                  <td className="py-3 px-4 tabular-nums">{formatNGN(c.min_purchase_kobo)}</td>
                  <td className="py-3 px-4 tabular-nums">
                    {c.used_count} / {c.usage_limit ?? '∞'}
                  </td>
                  <td className="py-3 px-4">{c.is_active ? 'Active' : 'Disabled'}</td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(c)}
                      className="px-2.5 py-1 border border-[#101820]/20"
                    >
                      {c.is_active ? 'Disable' : 'Activate'}
                    </button>
                    <button type="button" onClick={() => handleDelete(c.id)} className="p-1.5 text-red-700">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
