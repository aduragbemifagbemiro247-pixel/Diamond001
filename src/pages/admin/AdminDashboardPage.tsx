import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Plus } from 'lucide-react';
import { apiFetch, formatNGN } from '../../types/store';
import { useAdminAuth } from '../../context/AdminAuthContext';

interface DashboardData {
  period: string;
  kpis: {
    total_sales_kobo: number;
    total_orders: number;
    pending_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    registered_customers: number;
    available_products: number;
    low_stock_count: number;
    successful_transactions: number;
    failed_transactions: number;
  };
  sales_series: { bucket: string; collected_kobo: number; order_value_kobo: number; orders: number }[];
  recent_orders: {
    id: string;
    order_number: string;
    customer_name: string;
    total_kobo: number;
    payment_status: string;
    order_status: string;
    created_at: string;
  }[];
  recent_transactions: {
    id: string;
    reference: string;
    provider: string;
    amount_kobo: number;
    status: string;
    order_number: string;
    created_at: string;
  }[];
  best_selling_products: {
    product_id: string;
    product_name: string;
    units_sold: number;
    revenue_kobo: number;
  }[];
  low_stock_alerts: {
    variant_id: string;
    sku: string;
    size: string;
    color: string;
    product_name: string;
    available_stock: number;
  }[];
  order_status_overview: { order_status: string; count: number }[];
}

export const AdminDashboardPage: React.FC = () => {
  const { hasPermission } = useAdminAuth();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError('');
    apiFetch<DashboardData>(`/api/admin/dashboard?period=${period}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics.'))
      .finally(() => setLoading(false));
  }, [period, reloadTick]);

  const maxChartVal = Math.max(
    1,
    ...(data?.sales_series.map((s) => Math.max(s.collected_kobo, s.order_value_kobo)) || [1])
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">Store Overview</h1>
          <p className="text-xs text-[#707782] mt-1">
            Live database metrics across orders, payments, inventory, and customers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex bg-[#FFFFFF] border border-[#101820]/15 p-1">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  period === p ? 'bg-[#101820] text-[#FFFFFF]' : 'text-[#707782] hover:text-[#101820]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {hasPermission('products') && (
            <Link
              to="/admin/products/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D6B875] text-[#101820] text-xs font-semibold hover:bg-[#c8a862]"
            >
              <Plus className="w-3.5 h-3.5" /> Add Product
            </Link>
          )}
        </div>
      </div>

      {error ? (
        <div className="bg-[#FFFFFF] border border-red-200 p-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-800">Unable to load dashboard metrics</p>
            <p className="text-xs text-red-700 mt-1">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setReloadTick((n) => n + 1)}
            className="px-4 py-2 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider shrink-0"
          >
            Retry
          </button>
        </div>
      ) : loading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-[#FFFFFF] border border-[#101820]/10 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* 9 Required KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Collected Sales', value: formatNGN(data.kpis.total_sales_kobo) },
              { label: 'Total Orders', value: String(data.kpis.total_orders) },
              { label: 'Pending Orders', value: String(data.kpis.pending_orders) },
              { label: 'Completed Orders', value: String(data.kpis.completed_orders) },
              { label: 'Registered Customers', value: String(data.kpis.registered_customers) },
              { label: 'Published Products', value: String(data.kpis.available_products) },
              { label: 'Low Stock Variants', value: String(data.kpis.low_stock_count) },
              { label: 'Successful Txns', value: String(data.kpis.successful_transactions) },
              { label: 'Failed Txns', value: String(data.kpis.failed_transactions) },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-[#FFFFFF] border border-[#101820]/10 p-4">
                <p className="text-[11px] uppercase tracking-[0.1em] text-[#707782]">{kpi.label}</p>
                <p className="mt-2 text-xl sm:text-2xl font-semibold text-[#101820] tabular-nums">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Chart & Order Status Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-[#FFFFFF] border border-[#101820]/10 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-serif text-lg font-semibold text-[#101820]">Sales &amp; Order Value</h2>
                  <p className="text-xs text-[#707782]">
                    Gold: Collected Payments · Charcoal: Gross Order Value
                  </p>
                </div>
              </div>

              {data.sales_series.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-xs text-[#707782] border border-dashed border-[#101820]/15">
                  No order activity recorded for the selected {period} window.
                </div>
              ) : (
                <div className="h-56 flex items-end gap-2 pt-4 overflow-x-auto">
                  {data.sales_series.map((bar) => {
                    const orderH = Math.max(4, Math.round((bar.order_value_kobo / maxChartVal) * 160));
                    const paidH = Math.round((bar.collected_kobo / maxChartVal) * 160);
                    return (
                      <div key={bar.bucket} className="flex-1 min-w-[36px] flex flex-col items-center gap-1.5">
                        <div className="w-full max-w-[36px] flex items-end justify-center gap-1 h-44">
                          <div
                            title={`Order value: ${formatNGN(bar.order_value_kobo)}`}
                            style={{ height: `${orderH}px` }}
                            className="w-3 bg-[#101820]"
                          />
                          <div
                            title={`Collected: ${formatNGN(bar.collected_kobo)}`}
                            style={{ height: `${paidH}px` }}
                            className="w-3 bg-[#D6B875]"
                          />
                        </div>
                        <span className="text-[10px] font-mono text-[#707782] truncate max-w-full">
                          {bar.bucket.slice(-5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-4 bg-[#FFFFFF] border border-[#101820]/10 p-6">
              <h2 className="font-serif text-lg font-semibold text-[#101820]">Order Status Overview</h2>
              <div className="mt-4 space-y-2.5">
                {data.order_status_overview.length === 0 ? (
                  <p className="text-xs text-[#707782]">No orders yet.</p>
                ) : (
                  data.order_status_overview.map((row) => (
                    <div key={row.order_status} className="flex items-center justify-between text-xs py-1.5 border-b border-[#101820]/5">
                      <span className="capitalize text-[#101820]">{row.order_status.replace(/_/g, ' ')}</span>
                      <span className="font-mono font-semibold tabular-nums">{row.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Low Stock Alerts & Best Sellers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg font-semibold text-[#101820] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> Low-Stock Alerts
                </h2>
                <Link to="/admin/products" className="text-xs font-semibold text-[#B5954F] hover:underline">
                  Manage Inventory
                </Link>
              </div>
              {data.low_stock_alerts.length === 0 ? (
                <p className="text-xs text-[#707782]">All active product variants are above low-stock thresholds.</p>
              ) : (
                <div className="divide-y divide-[#101820]/5 text-xs">
                  {data.low_stock_alerts.map((item) => (
                    <div key={item.variant_id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-[#101820]">{item.product_name}</p>
                        <p className="text-[#707782]">
                          {item.color} · {item.size} · <span className="font-mono">{item.sku}</span>
                        </p>
                      </div>
                      <span className="font-mono font-semibold text-amber-700 tabular-nums">
                        {item.available_stock} left
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6">
              <h2 className="font-serif text-lg font-semibold text-[#101820] mb-4">Best-Selling Products</h2>
              {data.best_selling_products.length === 0 ? (
                <p className="text-xs text-[#707782]">Sales rankings will populate as orders are placed.</p>
              ) : (
                <div className="divide-y divide-[#101820]/5 text-xs">
                  {data.best_selling_products.map((b) => (
                    <div key={b.product_id || b.product_name} className="py-2.5 flex items-center justify-between gap-2">
                      <span className="font-medium text-[#101820]">{b.product_name}</span>
                      <span className="tabular-nums text-[#707782]">
                        {b.units_sold} sold · <strong className="text-[#101820]">{formatNGN(b.revenue_kobo)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Orders & Recent Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg font-semibold text-[#101820]">Recent Orders</h2>
                <Link to="/admin/orders" className="text-xs font-semibold text-[#B5954F] hover:underline">
                  All Orders
                </Link>
              </div>
              {data.recent_orders.length === 0 ? (
                <p className="text-xs text-[#707782]">No orders placed yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#101820]/10 text-[#707782]">
                        <th className="py-2 pr-3">Order</th>
                        <th className="py-2 pr-3">Customer</th>
                        <th className="py-2 pr-3">Total</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#101820]/5">
                      {data.recent_orders.map((o) => (
                        <tr key={o.id}>
                          <td className="py-2.5 pr-3 font-mono font-medium">{o.order_number}</td>
                          <td className="py-2.5 pr-3">{o.customer_name}</td>
                          <td className="py-2.5 pr-3 tabular-nums font-semibold">{formatNGN(o.total_kobo)}</td>
                          <td className="py-2.5 capitalize">{o.order_status.replace(/_/g, ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg font-semibold text-[#101820]">Recent Transactions</h2>
                <Link to="/admin/payments" className="text-xs font-semibold text-[#B5954F] hover:underline">
                  All Payments
                </Link>
              </div>
              {data.recent_transactions.length === 0 ? (
                <p className="text-xs text-[#707782]">No payment transactions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#101820]/10 text-[#707782]">
                        <th className="py-2 pr-3">Order</th>
                        <th className="py-2 pr-3">Provider</th>
                        <th className="py-2 pr-3">Amount</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#101820]/5">
                      {data.recent_transactions.map((t) => (
                        <tr key={t.id}>
                          <td className="py-2.5 pr-3 font-mono">{t.order_number}</td>
                          <td className="py-2.5 pr-3 capitalize">{t.provider.replace(/_/g, ' ')}</td>
                          <td className="py-2.5 pr-3 tabular-nums font-semibold">{formatNGN(t.amount_kobo)}</td>
                          <td className="py-2.5 capitalize">{t.status.replace(/_/g, ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
