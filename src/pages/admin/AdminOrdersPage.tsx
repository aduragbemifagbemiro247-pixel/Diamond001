import React, { useEffect, useState } from 'react';
import { Printer, Search } from 'lucide-react';
import { apiFetch, formatNGN } from '../../types/store';
import { useStore } from '../../context/StoreContext';

interface AdminOrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  country: string;
  state: string;
  city: string;
  delivery_address: string;
  subtotal_kobo: number;
  discount_kobo: number;
  delivery_fee_kobo: number;
  delivery_fee_payable_on_arrival: number;
  total_kobo: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  delivery_status: string | null;
  internal_notes: string | null;
  cancellation_reason: string | null;
  created_at: string;
  items: {
    id: string;
    product_name: string;
    variant_sku: string;
    size: string;
    color: string;
    quantity: number;
    unit_price_kobo: number;
    line_total_kobo: number;
  }[];
}

export const AdminOrdersPage: React.FC = () => {
  const { notify } = useStore();
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<{
    order: AdminOrderRow;
    items: AdminOrderRow['items'];
    payments: { id: string; reference: string; provider: string; amount_kobo: number; status: string }[];
    history: { id: string; status: string; note: string; created_at: string }[];
  } | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [statusNote, setStatusNote] = useState('');

  const loadOrders = () => {
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (statusFilter) qs.set('status', statusFilter);
    apiFetch<{ orders: AdminOrderRow[] }>(`/api/admin/orders?${qs.toString()}`)
      .then((res) => setOrders(res.orders))
      .catch((err) => notify(err instanceof Error ? err.message : 'Unable to load orders.', 'error'));
  };

  useEffect(() => {
    loadOrders();
  }, [search, statusFilter]);

  const openOrder = async (id: string) => {
    const data = await apiFetch<NonNullable<typeof selectedOrder>>(`/api/admin/orders/${id}`);
    setSelectedOrder(data);
    setNewStatus(data.order.order_status);
    setCancelReason(data.order.cancellation_reason || '');
    setInternalNotes(data.order.internal_notes || '');
    setStatusNote('');
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      await apiFetch(`/api/admin/orders/${selectedOrder.order.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          order_status: newStatus,
          cancellation_reason: newStatus === 'cancelled' ? cancelReason : undefined,
          internal_notes: internalNotes,
          note: statusNote || undefined,
        }),
      });
      notify(`Order ${selectedOrder.order.order_number} updated.`, 'success');
      await openOrder(selectedOrder.order.id);
      loadOrders();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update order.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">Orders</h1>
        <p className="text-xs text-[#707782] mt-1">Confirm, track, update statuses, record notes, and print invoices.</p>
      </div>

      <div className="bg-[#FFFFFF] border border-[#101820]/10 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 border border-[#101820]/15 px-3 py-2">
          <Search className="w-4 h-4 text-[#707782]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, customer name, or email..."
            className="flex-1 text-xs focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-[#101820]/15 px-3 py-2 text-xs bg-[#FFFFFF]"
        >
          <option value="">All Statuses</option>
          <option value="order_placed">Order Placed</option>
          <option value="payment_confirmed">Payment Confirmed</option>
          <option value="processing">Processing</option>
          <option value="ready_for_dispatch">Ready for Dispatch</option>
          <option value="shipped">Shipped</option>
          <option value="out_for_delivery">Out for Delivery</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-[#FFFFFF] border border-[#101820]/10 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#101820]/10 text-[#707782] bg-[#F7F5F0]/60">
              <th className="py-3 px-4">Order #</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Items</th>
              <th className="py-3 px-4">Total</th>
              <th className="py-3 px-4">Payment</th>
              <th className="py-3 px-4">Order Status</th>
              <th className="py-3 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#101820]/5">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#707782]">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="hover:bg-[#F7F5F0]/50">
                  <td className="py-3 px-4 font-mono font-semibold">{o.order_number}</td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-[#101820]">{o.customer_name}</p>
                    <p className="text-[11px] text-[#707782]">{o.city}, {o.country}</p>
                  </td>
                  <td className="py-3 px-4 tabular-nums">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="py-3 px-4 tabular-nums">{o.items.length} items</td>
                  <td className="py-3 px-4 tabular-nums font-semibold">{formatNGN(o.total_kobo)}</td>
                  <td className="py-3 px-4 capitalize">
                    {o.payment_method.replace(/_/g, ' ')} · <strong>{o.payment_status.replace(/_/g, ' ')}</strong>
                  </td>
                  <td className="py-3 px-4 capitalize font-medium">{o.order_status.replace(/_/g, ' ')}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => openOrder(o.id)}
                      className="px-3 py-1.5 border border-[#101820]/20 hover:bg-[#101820] hover:text-[#FFFFFF]"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-[#101820]/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] max-w-3xl w-full p-6 sm:p-8 border border-[#101820]/20 space-y-6 my-8">
            <div className="flex items-start justify-between border-b border-[#101820]/10 pb-4">
              <div>
                <p className="font-mono text-lg font-semibold">{selectedOrder.order.order_number}</p>
                <p className="text-xs text-[#707782]">
                  {selectedOrder.order.customer_name} · {selectedOrder.order.customer_email} · {selectedOrder.order.customer_phone}
                </p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#101820]/20 text-xs font-semibold"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-3 py-1.5 bg-[#101820] text-[#FFFFFF] text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#F7F5F0] p-4 border border-[#101820]/10">
              <div>
                <p className="uppercase tracking-wider text-[#707782]">Delivery Address</p>
                <p className="mt-1 font-medium">
                  {selectedOrder.order.delivery_address}, {selectedOrder.order.city}, {selectedOrder.order.state},{' '}
                  {selectedOrder.order.country}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-wider text-[#707782]">Totals &amp; Payment</p>
                <p className="mt-1 tabular-nums">
                  Subtotal: {formatNGN(selectedOrder.order.subtotal_kobo)} · Total: <strong>{formatNGN(selectedOrder.order.total_kobo)}</strong>
                </p>
                <p className="capitalize">
                  {selectedOrder.order.payment_method.replace(/_/g, ' ')} ({selectedOrder.order.payment_status.replace(/_/g, ' ')})
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#707782] mb-2">Ordered Items</h3>
              <table className="w-full text-xs border border-[#101820]/10">
                <thead>
                  <tr className="bg-[#F7F5F0] border-b border-[#101820]/10">
                    <th className="py-2 px-3 text-left">Item</th>
                    <th className="py-2 px-3 text-left">SKU</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#101820]/5">
                  {selectedOrder.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 px-3">{it.product_name} ({it.color} · {it.size})</td>
                      <td className="py-2 px-3 font-mono">{it.variant_sku}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{it.quantity}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold">{formatNGN(it.line_total_kobo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form onSubmit={handleUpdateOrder} className="space-y-4 pt-2 border-t border-[#101820]/10 no-print">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#101820]">Update Order Status &amp; Notes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Order Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full border border-[#101820]/20 px-3 py-2 text-xs bg-[#FFFFFF]"
                  >
                    <option value="order_placed">Order Placed</option>
                    <option value="payment_confirmed">Payment Confirmed</option>
                    <option value="processing">Processing</option>
                    <option value="ready_for_dispatch">Ready for Dispatch</option>
                    <option value="shipped">Shipped</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Status History Note</label>
                  <input
                    type="text"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Optional customer-visible note"
                    className="w-full border border-[#101820]/20 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {newStatus === 'cancelled' && (
                <div>
                  <label className="block text-xs font-medium mb-1">Cancellation Reason</label>
                  <input
                    type="text"
                    required
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full border border-[#101820]/20 px-3 py-2 text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1">Internal Staff Notes (Private)</label>
                <textarea
                  rows={2}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="w-full border border-[#101820]/20 px-3 py-2 text-xs"
                />
              </div>

              <button type="submit" className="px-6 py-2.5 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider">
                Save Order Update
              </button>
            </form>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#707782] mb-2">Status History</h3>
              <div className="space-y-1.5 text-xs">
                {selectedOrder.history.map((h) => (
                  <div key={h.id} className="flex justify-between gap-4 py-1 border-b border-[#101820]/5">
                    <span>
                      <strong className="capitalize">{h.status.replace(/_/g, ' ')}</strong> — {h.note}
                    </span>
                    <span className="text-[#707782] tabular-nums shrink-0">
                      {new Date(h.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
