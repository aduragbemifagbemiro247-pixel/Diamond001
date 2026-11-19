import React, { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { apiFetch, formatNGN } from '../../types/store';

interface ReportPayload {
  period: string;
  financial: {
    gross_order_value_kobo: number;
    collected_payments_kobo: number;
    delivery_charges_kobo: number;
    refunds_kobo: number;
    total_orders: number;
    completed_orders: number;
    pending_orders: number;
    cancelled_orders: number;
  };
  inventory_performance: {
    name: string;
    sku: string;
    size: string;
    color: string;
    quantity_on_hand: number;
    quantity_reserved: number;
    available: number;
  }[];
  orders: {
    order_number: string;
    customer_name: string;
    country: string;
    subtotal_kobo: number;
    discount_kobo: number;
    delivery_fee_kobo: number;
    total_kobo: number;
    payment_method: string;
    payment_status: string;
    order_status: string;
    created_at: string;
  }[];
}

export const AdminReportsPage: React.FC = () => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [report, setReport] = useState<ReportPayload | null>(null);

  useEffect(() => {
    apiFetch<ReportPayload>(`/api/admin/reports?period=${period}`)
      .then(setReport)
      .catch(() => {});
  }, [period]);

  const exportCsv = () => {
    if (!report) return;
    const headers = [
      'Order Number',
      'Customer',
      'Country',
      'Subtotal (NGN)',
      'Discount (NGN)',
      'Delivery Fee (NGN)',
      'Total Payable (NGN)',
      'Payment Method',
      'Payment Status',
      'Order Status',
      'Created At',
    ];
    const rows = report.orders.map((o) => [
      o.order_number,
      `"${o.customer_name.replace(/"/g, '""')}"`,
      o.country,
      (o.subtotal_kobo / 100).toFixed(2),
      (o.discount_kobo / 100).toFixed(2),
      (o.delivery_fee_kobo / 100).toFixed(2),
      (o.total_kobo / 100).toFixed(2),
      o.payment_method,
      o.payment_status,
      o.order_status,
      o.created_at,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diamond-store-report-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">Reports &amp; Analytics</h1>
          <p className="text-xs text-[#707782] mt-1">
            Separates gross order value, collected payments, delivery charges, and refunds accurately.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-[#FFFFFF] border border-[#101820]/15 p-1">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-medium capitalize ${
                  period === p ? 'bg-[#101820] text-[#FFFFFF]' : 'text-[#707782]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#101820] text-[#FFFFFF] text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#101820]/20 bg-[#FFFFFF] text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </button>
        </div>
      </div>

      {report && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Collected Revenue (Paid)', val: formatNGN(report.financial.collected_payments_kobo) },
              { label: 'Gross Order Value (Non-Cancelled)', val: formatNGN(report.financial.gross_order_value_kobo) },
              { label: 'Recorded Delivery Charges', val: formatNGN(report.financial.delivery_charges_kobo) },
              { label: 'Processed Refunds', val: formatNGN(report.financial.refunds_kobo) },
              { label: 'Total Orders', val: String(report.financial.total_orders) },
              { label: 'Completed Orders', val: String(report.financial.completed_orders) },
              { label: 'Pending Orders', val: String(report.financial.pending_orders) },
              { label: 'Cancelled Orders', val: String(report.financial.cancelled_orders) },
            ].map((item) => (
              <div key={item.label} className="bg-[#FFFFFF] border border-[#101820]/10 p-4">
                <p className="text-[11px] uppercase tracking-wider text-[#707782]">{item.label}</p>
                <p className="mt-2 text-xl font-semibold tabular-nums text-[#101820]">{item.val}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#FFFFFF] border border-[#101820]/10 overflow-x-auto">
            <div className="p-4 border-b border-[#101820]/10">
              <h2 className="font-serif text-lg font-semibold">Inventory Performance</h2>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#101820]/10 text-[#707782] bg-[#F7F5F0]/60">
                  <th className="py-2.5 px-4">Product</th>
                  <th className="py-2.5 px-4">SKU</th>
                  <th className="py-2.5 px-4">Variant</th>
                  <th className="py-2.5 px-4 text-right">On Hand</th>
                  <th className="py-2.5 px-4 text-right">Reserved</th>
                  <th className="py-2.5 px-4 text-right">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#101820]/5">
                {report.inventory_performance.map((row) => (
                  <tr key={row.sku}>
                    <td className="py-2.5 px-4 font-medium">{row.name}</td>
                    <td className="py-2.5 px-4 font-mono">{row.sku}</td>
                    <td className="py-2.5 px-4">{row.color} · {row.size}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{row.quantity_on_hand}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{row.quantity_reserved}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold">{row.available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
