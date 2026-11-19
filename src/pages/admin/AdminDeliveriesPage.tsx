import React, { useEffect, useState } from 'react';
import { apiFetch, formatNGN } from '../../types/store';
import { useStore } from '../../context/StoreContext';

interface DeliveryRow {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  country: string;
  state: string;
  city: string;
  delivery_address: string;
  delivery_fee_kobo: number;
  fee_payment_timing: 'prepaid' | 'pay_on_arrival';
  delivery_scope: 'nigeria' | 'international';
  courier_company: string | null;
  assigned_personnel: string | null;
  tracking_number: string | null;
  estimated_delivery_date: string | null;
  instructions: string | null;
  status: 'pending' | 'ready_for_dispatch' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled';
}

export const AdminDeliveriesPage: React.FC = () => {
  const { notify } = useStore();
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [editing, setEditing] = useState<DeliveryRow | null>(null);
  const [feeNaira, setFeeNaira] = useState('0');

  const load = () => {
    apiFetch<{ deliveries: DeliveryRow[] }>('/api/admin/deliveries')
      .then((res) => setDeliveries(res.deliveries))
      .catch((err) => notify(err instanceof Error ? err.message : 'Unable to load deliveries.', 'error'));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await apiFetch(`/api/admin/deliveries/${editing.order_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          delivery_fee_kobo: Math.round(Number(feeNaira) * 100),
          fee_payment_timing: editing.fee_payment_timing,
          courier_company: editing.courier_company,
          assigned_personnel: editing.assigned_personnel,
          tracking_number: editing.tracking_number,
          estimated_delivery_date: editing.estimated_delivery_date,
          instructions: editing.instructions,
          status: editing.status,
        }),
      });
      notify(`Delivery updated for ${editing.order_number}.`, 'success');
      setEditing(null);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to save delivery.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">Deliveries &amp; Logistics</h1>
        <p className="text-xs text-[#707782] mt-1">
          Set per-order delivery charges, prepaid vs pay-on-arrival timing, tracking references, and dispatch status.
        </p>
      </div>

      <div className="bg-[#FFFFFF] border border-[#101820]/10 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#101820]/10 text-[#707782] bg-[#F7F5F0]/60">
              <th className="py-3 px-4">Order</th>
              <th className="py-3 px-4">Destination</th>
              <th className="py-3 px-4">Fee &amp; Timing</th>
              <th className="py-3 px-4">Courier / Tracking</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#101820]/5">
            {deliveries.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#707782]">No delivery records yet.</td>
              </tr>
            ) : (
              deliveries.map((d) => (
                <tr key={d.id}>
                  <td className="py-3 px-4">
                    <p className="font-mono font-semibold">{d.order_number}</p>
                    <p className="text-[#707782]">{d.customer_name}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p>{d.city}, {d.state}, {d.country}</p>
                    <p className="text-[11px] text-[#707782] capitalize">{d.delivery_scope}</p>
                  </td>
                  <td className="py-3 px-4 tabular-nums">
                    <p className="font-semibold">{formatNGN(d.delivery_fee_kobo)}</p>
                    <p className="text-[11px] text-[#707782]">
                      {d.fee_payment_timing === 'pay_on_arrival' ? 'Pay on delivery day' : 'Prepaid'}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <p>{d.courier_company || d.assigned_personnel || '—'}</p>
                    {d.tracking_number && <p className="font-mono text-[11px]">{d.tracking_number}</p>}
                  </td>
                  <td className="py-3 px-4 capitalize">{d.status.replace(/_/g, ' ')}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(d);
                        setFeeNaira(String(d.delivery_fee_kobo / 100));
                      }}
                      className="px-3 py-1.5 border border-[#101820]/20 hover:bg-[#101820] hover:text-[#FFFFFF]"
                    >
                      Configure
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-[#101820]/70 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-[#FFFFFF] max-w-lg w-full p-6 border border-[#101820]/20 space-y-4">
            <h2 className="font-serif text-xl font-semibold">Delivery Arrangement · {editing.order_number}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Delivery Charge (₦)</label>
                <input
                  type="number"
                  min={0}
                  value={feeNaira}
                  onChange={(e) => setFeeNaira(e.target.value)}
                  className="w-full border border-[#101820]/20 px-3 py-2 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Fee Payment Timing</label>
                <select
                  value={editing.fee_payment_timing}
                  onChange={(e) =>
                    setEditing({ ...editing, fee_payment_timing: e.target.value as DeliveryRow['fee_payment_timing'] })
                  }
                  className="w-full border border-[#101820]/20 px-3 py-2 text-xs bg-[#FFFFFF]"
                >
                  <option value="pay_on_arrival">Payable on Delivery Day</option>
                  <option value="prepaid">Prepaid</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Delivery Company</label>
                <input
                  type="text"
                  value={editing.courier_company || ''}
                  onChange={(e) => setEditing({ ...editing, courier_company: e.target.value })}
                  className="w-full border border-[#101820]/20 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Assigned Personnel</label>
                <input
                  type="text"
                  value={editing.assigned_personnel || ''}
                  onChange={(e) => setEditing({ ...editing, assigned_personnel: e.target.value })}
                  className="w-full border border-[#101820]/20 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Tracking Number</label>
                <input
                  type="text"
                  value={editing.tracking_number || ''}
                  onChange={(e) => setEditing({ ...editing, tracking_number: e.target.value })}
                  className="w-full border border-[#101820]/20 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Estimated Delivery Date</label>
                <input
                  type="date"
                  value={editing.estimated_delivery_date || ''}
                  onChange={(e) => setEditing({ ...editing, estimated_delivery_date: e.target.value })}
                  className="w-full border border-[#101820]/20 px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Delivery Status</label>
              <select
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as DeliveryRow['status'] })}
                className="w-full border border-[#101820]/20 px-3 py-2 text-xs bg-[#FFFFFF]"
              >
                <option value="pending">Pending</option>
                <option value="ready_for_dispatch">Ready for Dispatch</option>
                <option value="shipped">Shipped</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 border border-[#101820]/20 text-xs font-semibold">
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 bg-[#101820] text-[#FFFFFF] text-xs font-semibold">
                Save Delivery
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
