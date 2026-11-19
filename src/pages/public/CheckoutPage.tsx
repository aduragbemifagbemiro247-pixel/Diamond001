import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Lock } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { apiFetch, formatNGN } from '../../types/store';
import { SeoHead } from '../../components/common/SeoHead';

export const CheckoutPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const {
    cart,
    cartSubtotalKobo,
    appliedCoupon,
    clearCart,
    storefront,
    customer,
    notify,
  } = useStore();

  const [fullName, setFullName] = useState(customer?.full_name || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [whatsapp, setWhatsapp] = useState(customer?.whatsapp_number || '');
  const [country, setCountry] = useState('Nigeria');
  const [stateRegion, setStateRegion] = useState('Oyo');
  const [city, setCity] = useState('Ogbomoso');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [instructions, setInstructions] = useState('');

  const enabledMethods = storefront?.payment_methods || [];
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<{
    order_number: string;
    total_kobo: number;
    payment_method: string;
    payment_status: string;
    delivery_fee_payable_on_arrival: number;
  } | null>(null);
  const [verifyingOnline, setVerifyingOnline] = useState(false);

  const idempotencyKey = useMemo(
    () => `ds-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  useEffect(() => {
    if (customer) {
      setFullName((v) => v || customer.full_name);
      setEmail((v) => v || customer.email);
      setPhone((v) => v || customer.phone || '');
      setWhatsapp((v) => v || customer.whatsapp_number || '');
    }
  }, [customer]);

  useEffect(() => {
    if (!paymentMethod && enabledMethods.length > 0) {
      setPaymentMethod(enabledMethods[0].id);
    }
  }, [enabledMethods, paymentMethod]);

  // Verify returning online gateway callback server-side
  useEffect(() => {
    const verifyFlag = searchParams.get('verify');
    const provider = searchParams.get('provider');
    const reference = searchParams.get('reference') || searchParams.get('trxref') || searchParams.get('tx_ref');
    const txId = searchParams.get('transaction_id');
    const orderNum = searchParams.get('order');

    if (verifyFlag === '1' && provider && reference) {
      setVerifyingOnline(true);
      const qs = new URLSearchParams({ provider, reference });
      if (txId) qs.set('transaction_id', txId);

      apiFetch<{ status: string }>(`/api/payments/verify?${qs.toString()}`)
        .then((res) => {
          if (res.status === 'successful') {
            clearCart();
            setCreatedOrder({
              order_number: orderNum || reference,
              total_kobo: 0,
              payment_method: provider,
              payment_status: 'paid',
              delivery_fee_payable_on_arrival: 1,
            });
            notify('Online payment verified successfully.', 'success');
          } else {
            notify('Payment could not be verified as successful.', 'error');
          }
        })
        .catch((err) => {
          notify(err instanceof Error ? err.message : 'Payment verification failed.', 'error');
        })
        .finally(() => setVerifyingOnline(false));
    }
  }, [searchParams, clearCart, notify]);

  const deliverySettings = storefront?.settings?.delivery;
  const discountKobo = appliedCoupon ? Math.min(appliedCoupon.discount_kobo, cartSubtotalKobo) : 0;
  const deliveryFeeKobo = deliverySettings?.default_fee_kobo || 0;
  const payableOnArrival = deliverySettings?.default_payable_on_arrival !== false;
  const totalPayableNow =
    Math.max(0, cartSubtotalKobo - discountKobo) + (payableOnArrival ? 0 : deliveryFeeKobo);

  const selectedMethodObj = enabledMethods.find((m) => m.id === paymentMethod);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      notify('Your shopping bag is empty.', 'error');
      return;
    }
    if (!paymentMethod) {
      notify('No payment method is currently available.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{
        order: {
          order_number: string;
          total_kobo: number;
          payment_method: string;
          payment_status: string;
          delivery_fee_payable_on_arrival: number;
        };
        payment: { authorization_url?: string };
      }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          customer_name: fullName,
          customer_email: email,
          customer_phone: phone,
          customer_whatsapp: whatsapp || undefined,
          country,
          state: stateRegion,
          city,
          delivery_address: address,
          postal_code: postalCode || undefined,
          delivery_instructions: instructions || undefined,
          payment_method: paymentMethod,
          coupon_code: appliedCoupon?.code || undefined,
          items: cart.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
        }),
      });

      if (res.payment?.authorization_url) {
        window.location.href = res.payment.authorization_url;
        return;
      }

      clearCart();
      setCreatedOrder(res.order);
      notify(`Order ${res.order.order_number} placed successfully.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to complete checkout.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (verifyingOnline) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold text-[#101820]">Verifying Payment...</h1>
        <p className="mt-3 text-sm text-[#707782]">
          Please wait while we confirm your transaction directly with the payment gateway.
        </p>
      </div>
    );
  }

  if (createdOrder) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-[#FFFFFF] border border-[#101820]/15 p-8 sm:p-10 text-center">
          <CheckCircle2 className="w-10 h-10 text-[#B5954F] mx-auto" />
          <h1 className="mt-4 font-serif text-3xl font-semibold text-[#101820]">Order Received</h1>
          <p className="mt-2 text-sm text-[#707782]">
            Your order reference is <span className="font-mono font-semibold text-[#101820]">{createdOrder.order_number}</span>
          </p>

          <div className="mt-6 p-4 bg-[#F7F5F0] border border-[#101820]/10 text-left text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-[#707782]">Payment Method</span>
              <span className="font-medium capitalize">{createdOrder.payment_method.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#707782]">Payment Status</span>
              <span className="font-medium capitalize">{createdOrder.payment_status.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#707782]">Delivery Fee Policy</span>
              <span>
                {createdOrder.delivery_fee_payable_on_arrival
                  ? 'Payable on delivery day'
                  : 'Prepaid with order'}
              </span>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              to={`/track-order?order=${encodeURIComponent(createdOrder.order_number)}`}
              className="px-6 py-3 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider"
            >
              Track Order
            </Link>
            <Link
              to="/shop"
              className="px-6 py-3 border border-[#101820]/20 text-[#101820] text-xs font-semibold uppercase tracking-wider"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SeoHead
        title="Secure Checkout — Diamond Store"
        description="Complete your Diamond Store order with verified Nigerian and international delivery arrangements."
        canonicalPath="/checkout"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="flex items-center justify-between pb-6 border-b border-[#101820]/10">
          <h1 className="font-serif text-3xl font-semibold text-[#101820]">Checkout</h1>
          <span className="inline-flex items-center gap-1.5 text-xs text-[#707782]">
            <Lock className="w-3.5 h-3.5 text-[#B5954F]" /> Server-Verified Order Processing
          </span>
        </div>

        {cart.length === 0 ? (
          <div className="mt-10 bg-[#FFFFFF] border border-[#101820]/10 p-10 text-center">
            <p className="text-sm text-[#707782]">Your shopping bag is currently empty.</p>
            <Link
              to="/shop"
              className="mt-4 inline-block px-6 py-2.5 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider"
            >
              Browse Shop
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-8">
              {/* Customer Details */}
              <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-xl font-semibold text-[#101820]">Customer Information</h2>
                  {!customer && (
                    <Link to="/account/login" className="text-xs font-semibold text-[#B5954F] hover:underline">
                      Sign in for faster checkout
                    </Link>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#101820] mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#101820] mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#101820] mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#101820] mb-1">WhatsApp Number (Optional)</label>
                    <input
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Details */}
              <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
                <h2 className="font-serif text-xl font-semibold text-[#101820]">Delivery Destination</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#101820] mb-1">Country *</label>
                    <input
                      type="text"
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#101820] mb-1">State / Province *</label>
                    <input
                      type="text"
                      required
                      value={stateRegion}
                      onChange={(e) => setStateRegion(e.target.value)}
                      className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#101820] mb-1">City *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#101820] mb-1">Postal Code (If Applicable)</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#101820] mb-1">Full Delivery Address *</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, house number, landmark"
                    className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#101820] mb-1">Delivery Instructions (Optional)</label>
                  <textarea
                    rows={2}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="w-full border border-[#101820]/20 px-3.5 py-2 text-sm focus:outline-none focus:border-[#101820]"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
                <h2 className="font-serif text-xl font-semibold text-[#101820]">Payment Method</h2>
                {enabledMethods.length === 0 ? (
                  <p className="text-sm text-red-700">
                    No payment methods are currently enabled. Please configure payment settings in the Admin Dashboard.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {enabledMethods.map((m) => (
                      <label
                        key={m.id}
                        className={`block p-4 border cursor-pointer transition-colors ${
                          paymentMethod === m.id
                            ? 'border-[#101820] bg-[#F7F5F0]'
                            : 'border-[#101820]/15 hover:border-[#101820]/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="payment_method"
                              value={m.id}
                              checked={paymentMethod === m.id}
                              onChange={() => setPaymentMethod(m.id)}
                              className="accent-[#101820]"
                            />
                            <span className="text-sm font-semibold text-[#101820]">{m.label}</span>
                          </div>
                          {m.mode && (
                            <span className="text-[11px] uppercase tracking-wider text-[#707782]">
                              {m.mode} mode
                            </span>
                          )}
                        </div>
                        {paymentMethod === m.id && m.id === 'bank_transfer' && (
                          <div className="mt-3 pt-3 border-t border-[#101820]/10 text-xs text-[#101820] space-y-1">
                            <p>Bank: <strong>{m.bank_name}</strong></p>
                            <p>Account Name: <strong>{m.account_name}</strong></p>
                            <p>Account Number: <strong className="font-mono">{m.account_number}</strong></p>
                            {m.instructions && <p className="text-[#707782] pt-1">{m.instructions}</p>}
                          </div>
                        )}
                        {paymentMethod === m.id && m.id === 'cash_on_delivery' && m.instructions && (
                          <p className="mt-2 text-xs text-[#707782]">{m.instructions}</p>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-5 lg:sticky lg:top-24">
              <h2 className="font-serif text-xl font-semibold text-[#101820]">Order Summary</h2>

              <div className="divide-y divide-[#101820]/10 max-h-72 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.variantId} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-[#101820] truncate">{item.productName}</p>
                      <p className="text-xs text-[#707782]">
                        {item.color} · {item.size} × {item.quantity}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums shrink-0">
                      {formatNGN(item.unitPriceKobo * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-[#101820]/10 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#707782]">Subtotal</span>
                  <span className="font-semibold tabular-nums">{formatNGN(cartSubtotalKobo)}</span>
                </div>
                {discountKobo > 0 && (
                  <div className="flex justify-between text-emerald-800">
                    <span>Coupon ({appliedCoupon?.code})</span>
                    <span className="font-semibold tabular-nums">-{formatNGN(discountKobo)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#707782]">Delivery Fee</span>
                  <span className="text-xs text-right">
                    {payableOnArrival
                      ? 'Set per order · Payable on delivery day'
                      : deliveryFeeKobo > 0
                      ? formatNGN(deliveryFeeKobo)
                      : 'Confirmed per destination'}
                  </span>
                </div>
                <div className="p-3 bg-[#F7F5F0] border border-[#101820]/10 text-xs text-[#707782] leading-relaxed">
                  {deliverySettings?.notes ||
                    'Delivery charges vary by Nigerian state or international destination and are confirmed by our logistics team.'}
                </div>
                <div className="flex justify-between pt-3 border-t border-[#101820]/10 text-base font-semibold text-[#101820]">
                  <span>Total Payable Now</span>
                  <span className="tabular-nums">{formatNGN(totalPayableNow)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedMethodObj}
                className="w-full py-4 bg-[#101820] text-[#FFFFFF] text-sm font-semibold hover:bg-[#101820]/90 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Processing Order...' : 'Confirm & Place Order'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
};
