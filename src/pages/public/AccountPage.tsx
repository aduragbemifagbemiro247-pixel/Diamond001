import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, MapPin, Package, Printer, User } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { apiFetch, formatNGN } from '../../types/store';
import { SeoHead } from '../../components/common/SeoHead';

interface Address {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  address_line: string;
  postal_code: string | null;
  is_default: number;
}

interface CustomerOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
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
  tracking_number: string | null;
  courier_company: string | null;
  created_at: string;
  items: {
    id: string;
    product_name: string;
    size: string;
    color: string;
    quantity: number;
    unit_price_kobo: number;
    line_total_kobo: number;
  }[];
}

interface PaymentRecord {
  id: string;
  order_number: string;
  provider: string;
  reference: string;
  amount_kobo: number;
  status: string;
  created_at: string;
}

export const AccountPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { customer, loadingCustomer, refreshCustomer, logoutCustomer, notify } = useStore();

  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(() => {
    if (location.pathname.endsWith('/register')) return 'register';
    return 'login';
  });

  useEffect(() => {
    if (location.pathname.endsWith('/register')) setAuthMode('register');
    else if (location.pathname.endsWith('/login')) setAuthMode('login');
  }, [location.pathname]);

  // Auth form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Account dashboard states
  const activeTab = location.pathname.endsWith('/orders')
    ? 'orders'
    : location.pathname.endsWith('/addresses')
    ? 'addresses'
    : 'profile';

  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileWhatsapp, setProfileWhatsapp] = useState('');
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [invoiceOrder, setInvoiceOrder] = useState<CustomerOrder | null>(null);

  const [newAddress, setNewAddress] = useState({
    label: 'Home',
    full_name: '',
    phone: '',
    country: 'Nigeria',
    state: 'Oyo',
    city: 'Ogbomoso',
    address_line: '',
    postal_code: '',
    is_default: true,
  });

  useEffect(() => {
    if (customer) {
      setProfileName(customer.full_name);
      setProfilePhone(customer.phone || '');
      setProfileWhatsapp(customer.whatsapp_number || '');
      Promise.all([
        apiFetch<{ orders: CustomerOrder[]; payments: PaymentRecord[] }>('/api/account/orders'),
        apiFetch<{ addresses: Address[] }>('/api/account/addresses'),
      ])
        .then(([ordRes, addrRes]) => {
          setOrders(ordRes.orders);
          setPayments(ordRes.payments);
          setAddresses(addrRes.addresses);
        })
        .catch(() => {});
    }
  }, [customer]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthSubmitting(true);
    try {
      if (authMode === 'login') {
        await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        await refreshCustomer();
        notify('Welcome back to Diamond Store.', 'success');
        navigate('/account');
      } else if (authMode === 'register') {
        await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ full_name: fullName, email, phone, password }),
        });
        await refreshCustomer();
        notify('Your customer account has been created.', 'success');
        navigate('/account');
      } else if (authMode === 'forgot') {
        const res = await apiFetch<{ message: string }>('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        notify(res.message, 'info');
        setAuthMode('reset');
      } else if (authMode === 'reset') {
        const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token: resetToken, new_password: password }),
        });
        notify(res.message, 'success');
        setAuthMode('login');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Authentication error.', 'error');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/account/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: profileName,
          phone: profilePhone,
          whatsapp_number: profileWhatsapp,
        }),
      });
      await refreshCustomer();
      notify('Profile updated.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to save profile.', 'error');
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/account/addresses', {
        method: 'POST',
        body: JSON.stringify(newAddress),
      });
      const res = await apiFetch<{ addresses: Address[] }>('/api/account/addresses');
      setAddresses(res.addresses);
      setNewAddress((prev) => ({ ...prev, address_line: '', postal_code: '' }));
      notify('Address saved.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to save address.', 'error');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    await apiFetch(`/api/account/addresses/${id}`, { method: 'DELETE' });
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  if (loadingCustomer) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="h-64 bg-[#FFFFFF] border border-[#101820]/10 animate-pulse" />
      </div>
    );
  }

  if (!customer) {
    return (
      <>
        <SeoHead
          title="Customer Account — Diamond Store"
          description="Sign in or create a Diamond Store customer account to manage addresses, orders, and invoices."
        />
        <div className="max-w-md mx-auto px-4 py-14">
          <div className="bg-[#FFFFFF] border border-[#101820]/15 p-8">
            <h1 className="font-serif text-2xl font-semibold text-[#101820]">
              {authMode === 'login'
                ? 'Customer Sign In'
                : authMode === 'register'
                ? 'Create Account'
                : authMode === 'forgot'
                ? 'Forgot Password'
                : 'Reset Password'}
            </h1>
            <p className="mt-1.5 text-xs text-[#707782]">
              {authMode === 'login'
                ? 'Access your orders, invoices, and saved delivery addresses.'
                : authMode === 'register'
                ? 'Join Diamond Store for seamless checkout and order history.'
                : 'Recover access to your Diamond Store account.'}
            </p>

            <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
              {authMode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                    />
                  </div>
                </>
              )}

              {authMode !== 'reset' && (
                <div>
                  <label className="block text-xs font-medium mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                  />
                </div>
              )}

              {authMode === 'reset' && (
                <div>
                  <label className="block text-xs font-medium mb-1">Reset Token *</label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#101820]"
                  />
                </div>
              )}

              {authMode !== 'forgot' && (
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {authMode === 'reset' ? 'New Password *' : 'Password *'}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={authMode === 'login' ? 1 : 8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3 bg-[#101820] text-[#FFFFFF] text-sm font-semibold hover:bg-[#101820]/90 transition-colors disabled:opacity-50"
              >
                {authSubmitting
                  ? 'Please wait...'
                  : authMode === 'login'
                  ? 'Sign In'
                  : authMode === 'register'
                  ? 'Create Account'
                  : authMode === 'forgot'
                  ? 'Request Reset Token'
                  : 'Update Password'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-[#101820]/10 flex flex-wrap justify-between gap-2 text-xs text-[#707782]">
              {authMode === 'login' ? (
                <>
                  <button type="button" onClick={() => setAuthMode('register')} className="hover:text-[#101820] font-semibold">
                    Create an account
                  </button>
                  <button type="button" onClick={() => setAuthMode('forgot')} className="hover:text-[#101820]">
                    Forgot password?
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setAuthMode('login')} className="hover:text-[#101820] font-semibold">
                  Back to Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SeoHead title="My Account — Diamond Store" description="Manage your Diamond Store profile, orders, payments, and delivery addresses." />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#101820]/10 no-print">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#707782]">Customer Account</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-[#101820]">{customer.full_name}</h1>
          </div>
          <button
            type="button"
            onClick={logoutCustomer}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#101820]/20 text-xs font-semibold hover:bg-[#101820] hover:text-[#FFFFFF] transition-colors self-start"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Navigation */}
          <aside className="lg:col-span-3 bg-[#FFFFFF] border border-[#101820]/10 p-3 space-y-1 no-print">
            <Link
              to="/account"
              className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium ${
                activeTab === 'profile' ? 'bg-[#101820] text-[#FFFFFF]' : 'text-[#707782] hover:text-[#101820]'
              }`}
            >
              <User className="w-4 h-4" /> Profile
            </Link>
            <Link
              to="/account/orders"
              className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium ${
                activeTab === 'orders' ? 'bg-[#101820] text-[#FFFFFF]' : 'text-[#707782] hover:text-[#101820]'
              }`}
            >
              <Package className="w-4 h-4" /> Orders &amp; Payments
            </Link>
            <Link
              to="/account/addresses"
              className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium ${
                activeTab === 'addresses' ? 'bg-[#101820] text-[#FFFFFF]' : 'text-[#707782] hover:text-[#101820]'
              }`}
            >
              <MapPin className="w-4 h-4" /> Saved Addresses
            </Link>
          </aside>

          {/* Tab Body */}
          <div className="lg:col-span-9 space-y-6">
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileSave} className="bg-[#FFFFFF] border border-[#101820]/10 p-6 sm:p-8 space-y-4">
                <h2 className="font-serif text-2xl font-semibold text-[#101820]">Profile Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Email</label>
                    <input
                      type="email"
                      disabled
                      value={customer.email}
                      className="w-full border border-[#101820]/10 bg-[#F7F5F0] px-3.5 py-2.5 text-sm text-[#707782]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">WhatsApp Number</label>
                    <input
                      type="tel"
                      value={profileWhatsapp}
                      onChange={(e) => setProfileWhatsapp(e.target.value)}
                      className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>
                <button type="submit" className="px-6 py-2.5 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider">
                  Save Profile
                </button>
              </form>
            )}

            {activeTab === 'orders' && (
              <div className="space-y-6">
                <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6">
                  <h2 className="font-serif text-2xl font-semibold text-[#101820]">Order History</h2>
                  {orders.length === 0 ? (
                    <p className="mt-4 text-sm text-[#707782]">You have not placed any orders yet.</p>
                  ) : (
                    <div className="mt-4 divide-y divide-[#101820]/10">
                      {orders.map((ord) => (
                        <div key={ord.id} className="py-5 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-mono text-sm font-semibold text-[#101820]">{ord.order_number}</span>
                              <span className="ml-3 text-xs text-[#707782]">
                                {new Date(ord.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="capitalize text-[#707782]">
                                Order: <strong className="text-[#101820]">{ord.order_status.replace(/_/g, ' ')}</strong>
                              </span>
                              <span>·</span>
                              <span className="capitalize text-[#707782]">
                                Payment: <strong className="text-[#101820]">{ord.payment_status.replace(/_/g, ' ')}</strong>
                              </span>
                            </div>
                          </div>

                          <div className="text-xs text-[#707782] space-y-1">
                            {ord.items.map((it) => (
                              <p key={it.id}>
                                {it.product_name} ({it.color}, {it.size}) × {it.quantity} —{' '}
                                <span className="tabular-nums font-medium text-[#101820]">{formatNGN(it.line_total_kobo)}</span>
                              </p>
                            ))}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                            <span className="text-sm font-semibold tabular-nums">
                              Total: {formatNGN(ord.total_kobo)}
                            </span>
                            <div className="flex items-center gap-3">
                              <Link
                                to={`/track-order?order=${encodeURIComponent(ord.order_number)}`}
                                className="text-xs font-semibold text-[#B5954F] hover:underline"
                              >
                                Track Order
                              </Link>
                              <button
                                type="button"
                                onClick={() => setInvoiceOrder(ord)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#101820] hover:underline"
                              >
                                <Printer className="w-3.5 h-3.5" /> View Invoice
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment History */}
                <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6">
                  <h2 className="font-serif text-xl font-semibold text-[#101820]">Payment History</h2>
                  {payments.length === 0 ? (
                    <p className="mt-3 text-sm text-[#707782]">No payment records yet.</p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#101820]/10 text-[#707782]">
                            <th className="py-2 pr-4">Reference</th>
                            <th className="py-2 pr-4">Order</th>
                            <th className="py-2 pr-4">Provider</th>
                            <th className="py-2 pr-4">Amount</th>
                            <th className="py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#101820]/5">
                          {payments.map((p) => (
                            <tr key={p.id}>
                              <td className="py-2.5 pr-4 font-mono">{p.reference}</td>
                              <td className="py-2.5 pr-4 font-mono">{p.order_number}</td>
                              <td className="py-2.5 pr-4 capitalize">{p.provider.replace(/_/g, ' ')}</td>
                              <td className="py-2.5 pr-4 tabular-nums font-semibold">{formatNGN(p.amount_kobo)}</td>
                              <td className="py-2.5 capitalize">{p.status.replace(/_/g, ' ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'addresses' && (
              <div className="space-y-6">
                <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6">
                  <h2 className="font-serif text-2xl font-semibold text-[#101820]">Saved Addresses</h2>
                  {addresses.length === 0 ? (
                    <p className="mt-3 text-sm text-[#707782]">No saved addresses yet.</p>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {addresses.map((addr) => (
                        <div key={addr.id} className="p-4 border border-[#101820]/15 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <strong className="text-sm text-[#101820]">{addr.label}</strong>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="text-red-700 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                          <p>{addr.full_name} · {addr.phone}</p>
                          <p className="text-[#707782]">
                            {addr.address_line}, {addr.city}, {addr.state}, {addr.country}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <form onSubmit={handleAddAddress} className="bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
                  <h3 className="font-serif text-lg font-semibold text-[#101820]">Add Delivery Address</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      required
                      placeholder="Label (e.g. Home, Office)"
                      value={newAddress.label}
                      onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                      className="border border-[#101820]/20 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Recipient Full Name"
                      value={newAddress.full_name}
                      onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                      className="border border-[#101820]/20 px-3 py-2 text-sm"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="Phone Number"
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      className="border border-[#101820]/20 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Country"
                      value={newAddress.country}
                      onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })}
                      className="border border-[#101820]/20 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      required
                      placeholder="State / Province"
                      value={newAddress.state}
                      onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                      className="border border-[#101820]/20 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      required
                      placeholder="City"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      className="border border-[#101820]/20 px-3 py-2 text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Full Street Address"
                    value={newAddress.address_line}
                    onChange={(e) => setNewAddress({ ...newAddress, address_line: e.target.value })}
                    className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
                  />
                  <button type="submit" className="px-6 py-2.5 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider">
                    Save Address
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Printable Invoice Modal */}
        {invoiceOrder && (
          <div className="fixed inset-0 z-50 bg-[#101820]/70 flex items-center justify-center p-4">
            <div className="bg-[#FFFFFF] max-w-xl w-full p-8 border border-[#101820]/20 space-y-5">
              <div className="flex items-start justify-between border-b border-[#101820]/10 pb-4">
                <div>
                  <p className="font-serif text-xl tracking-[0.15em] font-semibold">DIAMOND STORE</p>
                  <p className="text-xs text-[#707782]">Ogbomoso, Oyo State, Nigeria</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold">INVOICE</p>
                  <p className="font-mono">{invoiceOrder.order_number}</p>
                </div>
              </div>

              <div className="text-xs space-y-1">
                <p><strong>Billed To:</strong> {invoiceOrder.customer_name}</p>
                <p><strong>Delivery:</strong> {invoiceOrder.delivery_address}, {invoiceOrder.city}, {invoiceOrder.state}, {invoiceOrder.country}</p>
              </div>

              <table className="w-full text-xs border-t border-b border-[#101820]/10">
                <thead>
                  <tr className="text-[#707782] border-b border-[#101820]/10">
                    <th className="py-2 text-left">Item</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceOrder.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2">{it.product_name} ({it.color} · {it.size})</td>
                      <td className="py-2 text-right tabular-nums">{it.quantity}</td>
                      <td className="py-2 text-right tabular-nums">{formatNGN(it.line_total_kobo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="text-xs space-y-1 text-right tabular-nums">
                <p>Subtotal: {formatNGN(invoiceOrder.subtotal_kobo)}</p>
                {invoiceOrder.discount_kobo > 0 && <p>Discount: -{formatNGN(invoiceOrder.discount_kobo)}</p>}
                <p>Delivery Fee: {invoiceOrder.delivery_fee_payable_on_arrival ? 'Payable on delivery day' : formatNGN(invoiceOrder.delivery_fee_kobo)}</p>
                <p className="text-sm font-semibold pt-1">Total: {formatNGN(invoiceOrder.total_kobo)}</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#101820] text-[#FFFFFF] text-xs font-semibold"
                >
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceOrder(null)}
                  className="px-4 py-2 border border-[#101820]/20 text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
