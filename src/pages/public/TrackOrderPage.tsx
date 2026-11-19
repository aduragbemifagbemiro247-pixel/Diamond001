import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, PackageCheck, Truck, XCircle } from 'lucide-react';
import { apiFetch, formatNGN } from '../../types/store';
import { SeoHead } from '../../components/common/SeoHead';

const TRACK_STAGES = [
  { key: 'order_placed', label: 'Order Placed' },
  { key: 'payment_confirmed', label: 'Payment Confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'ready_for_dispatch', label: 'Ready for Dispatch' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

export const TrackOrderPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('order') || '');
  const [verification, setVerification] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    order: {
      order_number: string;
      customer_name: string;
      country: string;
      state: string;
      city: string;
      subtotal_kobo: number;
      discount_kobo: number;
      delivery_fee_kobo: number;
      delivery_fee_payable_on_arrival: boolean;
      total_kobo: number;
      payment_method: string;
      payment_status: string;
      order_status: string;
      cancellation_reason: string | null;
      created_at: string;
    };
    items: {
      product_name: string;
      size: string;
      color: string;
      quantity: number;
      line_total_kobo: number;
    }[];
    delivery: {
      courier_company: string | null;
      tracking_number: string | null;
      estimated_delivery_date: string | null;
      fee_payment_timing: string;
      delivery_fee_kobo: number;
    } | null;
    history: { status: string; note: string; created_at: string }[];
  } | null>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<typeof result>('/api/orders/track', {
        method: 'POST',
        body: JSON.stringify({ order_number: orderNumber, verification }),
      });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Unable to locate order.');
    } finally {
      setLoading(false);
    }
  };

  const currentIdx = result
    ? TRACK_STAGES.findIndex((s) => s.key === result.order.order_status)
    : -1;
  const isExceptionState =
    result && ['cancelled', 'payment_failed', 'refunded'].includes(result.order.order_status);

  return (
    <>
      <SeoHead
        title="Track Your Order — Diamond Store"
        description="Track your Diamond Store order progress across Nigeria and international destinations."
        canonicalPath="/track-order"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
        <div className="text-center max-w-xl mx-auto">
          <p className="text-xs uppercase tracking-[0.16em] text-[#707782]">Order Verification</p>
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-semibold text-[#101820]">Track Your Order</h1>
          <p className="mt-3 text-sm text-[#707782]">
            Enter your Diamond Store order number together with the email address or phone number used at checkout.
          </p>
        </div>

        <form onSubmit={handleTrack} className="mt-8 bg-[#FFFFFF] border border-[#101820]/15 p-6 grid grid-cols-1 sm:grid-cols-12 gap-4">
          <div className="sm:col-span-5">
            <label className="block text-xs font-medium mb-1">Order Number *</label>
            <input
              type="text"
              required
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="e.g. DS-261119-A1B2C3"
              className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-[#101820]"
            />
          </div>
          <div className="sm:col-span-5">
            <label className="block text-xs font-medium mb-1">Checkout Email or Phone *</label>
            <input
              type="text"
              required
              value={verification}
              onChange={(e) => setVerification(e.target.value)}
              placeholder="Email or phone number"
              className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
            />
          </div>
          <div className="sm:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider hover:bg-[#101820]/90"
            >
              {loading ? 'Checking...' : 'Track'}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 text-sm text-red-800">{error}</div>
        )}

        {result && (
          <div className="mt-8 bg-[#FFFFFF] border border-[#101820]/15 p-6 sm:p-8 space-y-8">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#101820]/10">
              <div>
                <p className="font-mono text-lg font-semibold text-[#101820]">{result.order.order_number}</p>
                <p className="text-xs text-[#707782] mt-1">
                  Destination: {result.order.city}, {result.order.state}, {result.order.country}
                </p>
              </div>
              <div className="text-right text-xs space-y-1">
                <p className="capitalize">
                  Status: <strong className="text-[#101820]">{result.order.order_status.replace(/_/g, ' ')}</strong>
                </p>
                <p className="capitalize">
                  Payment: <strong className="text-[#101820]">{result.order.payment_status.replace(/_/g, ' ')}</strong>
                </p>
              </div>
            </div>

            {isExceptionState ? (
              <div className="p-4 bg-red-50 border border-red-200 flex items-start gap-3 text-sm text-red-900">
                <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold capitalize">{result.order.order_status.replace(/_/g, ' ')}</p>
                  {result.order.cancellation_reason && (
                    <p className="mt-1 text-xs">{result.order.cancellation_reason}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {TRACK_STAGES.map((stage, idx) => {
                  const completed = currentIdx >= idx;
                  return (
                    <div
                      key={stage.key}
                      className={`p-3 border text-center ${
                        completed ? 'border-[#101820] bg-[#F7F5F0]' : 'border-[#101820]/10 opacity-50'
                      }`}
                    >
                      <div className="flex justify-center mb-2">
                        {completed ? (
                          <CheckCircle2 className="w-4 h-4 text-[#B5954F]" />
                        ) : idx === currentIdx + 1 ? (
                          <Clock className="w-4 h-4 text-[#707782]" />
                        ) : (
                          <PackageCheck className="w-4 h-4 text-[#707782]" />
                        )}
                      </div>
                      <p className="text-[11px] font-semibold leading-tight text-[#101820]">{stage.label}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {result.delivery && (
              <div className="p-4 bg-[#F7F5F0] border border-[#101820]/10 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2.5">
                  <Truck className="w-4 h-4 text-[#B5954F]" />
                  <span>
                    Delivery Fee:{' '}
                    <strong>
                      {result.delivery.delivery_fee_kobo > 0
                        ? formatNGN(result.delivery.delivery_fee_kobo)
                        : 'Set per order'}
                    </strong>{' '}
                    ({result.delivery.fee_payment_timing === 'pay_on_arrival' ? 'Payable on delivery day' : 'Prepaid'})
                  </span>
                </div>
                {result.delivery.tracking_number && (
                  <span>
                    Tracking Ref: <strong className="font-mono">{result.delivery.tracking_number}</strong>
                    {result.delivery.courier_company ? ` (${result.delivery.courier_company})` : ''}
                  </span>
                )}
              </div>
            )}

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#707782]">Status Timeline</h2>
              <div className="mt-3 space-y-2.5">
                {result.history.map((h, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-4 text-xs border-b border-[#101820]/5 pb-2">
                    <div>
                      <span className="font-semibold capitalize text-[#101820]">{h.status.replace(/_/g, ' ')}</span>
                      {h.note && <span className="text-[#707782]"> — {h.note}</span>}
                    </div>
                    <span className="text-[#707782] tabular-nums shrink-0">
                      {new Date(h.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
