import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { apiFetch, formatNGN } from '../../types/store';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { SeoHead } from '../../components/common/SeoHead';

export const CartPage: React.FC = () => {
  const {
    cart,
    cartSubtotalKobo,
    updateCartQuantity,
    removeFromCart,
    appliedCoupon,
    setAppliedCoupon,
    storefront,
    customer,
    notify,
  } = useStore();

  const [couponInput, setCouponInput] = useState(appliedCoupon?.code || '');
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const deliveryFeeKobo = storefront?.settings?.delivery?.default_fee_kobo || 0;
  const payableOnArrival = storefront?.settings?.delivery?.default_payable_on_arrival !== false;
  const discountKobo = appliedCoupon ? Math.min(appliedCoupon.discount_kobo, cartSubtotalKobo) : 0;
  const totalKobo = Math.max(0, cartSubtotalKobo - discountKobo) + (payableOnArrival ? 0 : deliveryFeeKobo);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setValidatingCoupon(true);
    try {
      const res = await apiFetch<{ valid: boolean; code: string; discount_kobo: number }>(
        '/api/coupons/validate',
        {
          method: 'POST',
          body: JSON.stringify({
            code: couponInput,
            subtotal_kobo: cartSubtotalKobo,
            email: customer?.email || '',
          }),
        }
      );
      setAppliedCoupon({ code: res.code, discount_kobo: res.discount_kobo });
      notify(`Coupon ${res.code} applied.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Invalid coupon code.', 'error');
    } finally {
      setValidatingCoupon(false);
    }
  };

  return (
    <>
      <SeoHead
        title="Shopping Bag — Diamond Store"
        description="Review items in your Diamond Store shopping bag, apply promo codes, and proceed to secure checkout."
        canonicalPath="/cart"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#101820] pb-6 border-b border-[#101820]/10">
          Shopping Bag
        </h1>

        {cart.length === 0 ? (
          <div className="mt-10 bg-[#FFFFFF] border border-[#101820]/10 p-12 text-center">
            <h2 className="font-serif text-2xl font-semibold text-[#101820]">Your bag is empty</h2>
            <p className="mt-2 text-sm text-[#707782]">
              Explore our menswear, handcrafted footwear, and accessories to add items to your bag.
            </p>
            <Link
              to="/shop"
              className="mt-6 inline-block px-7 py-3 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Items */}
            <div className="lg:col-span-8 space-y-4">
              {cart.map((item) => (
                <div
                  key={item.variantId}
                  className="bg-[#FFFFFF] border border-[#101820]/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5"
                >
                  <Link
                    to={`/product/${item.productSlug}`}
                    className="w-28 aspect-[4/3] bg-[#EBE7DE] shrink-0 overflow-hidden"
                  >
                    <ImageWithFallback
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-full h-full object-cover"
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/product/${item.productSlug}`}
                      className="font-semibold text-base text-[#101820] hover:text-[#B5954F]"
                    >
                      {item.productName}
                    </Link>
                    <p className="mt-1 text-xs text-[#707782]">
                      Colour: {item.color} · Size: {item.size} · SKU: <span className="font-mono">{item.variantSku}</span>
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#101820] tabular-nums">
                      {formatNGN(item.unitPriceKobo)} each
                    </p>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="inline-flex items-center border border-[#101820]/20">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.variantId, item.quantity - 1)}
                        aria-label="Decrease quantity"
                        className="p-2 hover:bg-[#F7F5F0]"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-sm font-semibold tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        disabled={item.quantity >= item.maxStock}
                        onClick={() => updateCartQuantity(item.variantId, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="p-2 hover:bg-[#F7F5F0] disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right min-w-[5.5rem] tabular-nums font-semibold text-sm text-[#101820]">
                      {formatNGN(item.unitPriceKobo * item.quantity)}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.variantId)}
                      aria-label="Remove item"
                      className="p-2 text-[#707782] hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="lg:col-span-4 bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-5">
              <h2 className="font-serif text-xl font-semibold text-[#101820]">Order Summary</h2>

              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Coupon code"
                  className="flex-1 border border-[#101820]/20 px-3 py-2 text-xs uppercase focus:outline-none focus:border-[#101820]"
                />
                <button
                  type="submit"
                  disabled={validatingCoupon}
                  className="px-4 py-2 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider"
                >
                  Apply
                </button>
              </form>

              {appliedCoupon && (
                <div className="flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 px-3 py-2 border border-emerald-200">
                  <span>Coupon {appliedCoupon.code} applied</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedCoupon(null);
                      setCouponInput('');
                    }}
                    className="underline"
                  >
                    Remove
                  </button>
                </div>
              )}

              <div className="space-y-2.5 pt-4 border-t border-[#101820]/10 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#707782]">Subtotal</span>
                  <span className="font-semibold tabular-nums">{formatNGN(cartSubtotalKobo)}</span>
                </div>
                {discountKobo > 0 && (
                  <div className="flex justify-between text-emerald-800">
                    <span>Discount</span>
                    <span className="font-semibold tabular-nums">-{formatNGN(discountKobo)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#707782]">Delivery Arrangement</span>
                  <span className="text-xs text-right text-[#101820]">
                    {payableOnArrival
                      ? 'Payable on delivery day'
                      : deliveryFeeKobo > 0
                      ? formatNGN(deliveryFeeKobo)
                      : 'Confirmed per order'}
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t border-[#101820]/10 text-base font-semibold text-[#101820]">
                  <span>Total Payable Now</span>
                  <span className="tabular-nums">{formatNGN(totalKobo)}</span>
                </div>
              </div>

              <Link
                to="/checkout"
                className="block w-full text-center py-3.5 bg-[#D6B875] text-[#101820] text-sm font-semibold hover:bg-[#c8a862] transition-colors"
              >
                Proceed to Checkout
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
