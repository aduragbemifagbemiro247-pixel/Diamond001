import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { apiFetch, formatNGN } from '../../types/store';
import { useStore } from '../../context/StoreContext';
import { useAdminAuth } from '../../context/AdminAuthContext';

interface Readiness {
  paystack: {
    enabled: boolean;
    mode: 'test' | 'live';
    public_key_configured: boolean;
    secret_key_configured: boolean;
    ready: boolean;
    public_key: string;
    webhook_url: string;
  };
  flutterwave: {
    enabled: boolean;
    mode: 'test' | 'live';
    public_key_configured: boolean;
    secret_key_configured: boolean;
    ready: boolean;
    public_key: string;
    webhook_url: string;
  };
  bank_transfer: {
    enabled: boolean;
    ready: boolean;
    bank_name: string;
    account_name: string;
    account_number: string;
    instructions: string;
  };
  cash_on_delivery: {
    enabled: boolean;
    ready: boolean;
    instructions: string;
    requires_admin_approval: boolean;
  };
}

export const AdminPaymentsPage: React.FC = () => {
  const { notify } = useStore();
  const { admin } = useAdminAuth();
  const [transactions, setTransactions] = useState<
    {
      id: string;
      reference: string;
      order_number: string;
      customer_name: string;
      provider: string;
      amount_kobo: number;
      status: string;
      created_at: string;
    }[]
  >([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch<{ transactions: typeof transactions; readiness: Readiness }>('/api/admin/payments')
      .then((res) => {
        setTransactions(res.transactions);
        setReadiness(res.readiness);
      })
      .catch((err) => notify(err instanceof Error ? err.message : 'Failed to load payments.', 'error'));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!readiness) return;
    setSaving(true);
    try {
      await apiFetch('/api/admin/payment-settings', {
        method: 'PUT',
        body: JSON.stringify({
          paystack: {
            enabled: readiness.paystack.enabled,
            mode: readiness.paystack.mode,
            public_key: readiness.paystack.public_key,
          },
          flutterwave: {
            enabled: readiness.flutterwave.enabled,
            mode: readiness.flutterwave.mode,
            public_key: readiness.flutterwave.public_key,
          },
          bank_transfer: readiness.bank_transfer,
          cash_on_delivery: readiness.cash_on_delivery,
        }),
      });
      notify('Payment settings saved.', 'success');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to save payment settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleManualVerify = async (paymentId: string) => {
    try {
      await apiFetch(`/api/admin/payments/${paymentId}/verify-manual`, { method: 'POST' });
      notify('Payment verified and order confirmed.', 'success');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Verification failed.', 'error');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">Payments &amp; Gateways</h1>
        <p className="text-xs text-[#707782] mt-1">
          Configure Paystack, Flutterwave, Bank Transfer, and Cash on Delivery. Secret keys remain strictly in server environment variables.
        </p>
      </div>

      {readiness && admin?.role === 'super_admin' && (
        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Paystack */}
          <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold">Paystack</h2>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${readiness.paystack.ready ? 'text-emerald-700' : 'text-amber-700'}`}>
                {readiness.paystack.ready ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {readiness.paystack.ready ? 'Ready for Checkout' : 'Not Ready (Missing Secret/Config)'}
              </span>
            </div>
            <div className="flex items-center gap-6 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={readiness.paystack.enabled}
                  onChange={(e) =>
                    setReadiness({ ...readiness, paystack: { ...readiness.paystack, enabled: e.target.checked } })
                  }
                />
                Enable Paystack
              </label>
              <select
                value={readiness.paystack.mode}
                onChange={(e) =>
                  setReadiness({
                    ...readiness,
                    paystack: { ...readiness.paystack, mode: e.target.value as 'test' | 'live' },
                  })
                }
                className="border border-[#101820]/20 px-2.5 py-1 bg-[#FFFFFF]"
              >
                <option value="test">Test Mode</option>
                <option value="live">Live Mode</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Public Key (Optional override if not in env)</label>
              <input
                type="text"
                value={readiness.paystack.public_key}
                onChange={(e) =>
                  setReadiness({ ...readiness, paystack: { ...readiness.paystack, public_key: e.target.value } })
                }
                placeholder="pk_test_..."
                className="w-full border border-[#101820]/20 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div className="text-[11px] text-[#707782] space-y-1">
              <p>Server Secret Key (`PAYSTACK_SECRET_KEY`): {readiness.paystack.secret_key_configured ? 'Configured' : 'Not configured in server env'}</p>
              <p>Webhook URL: <code className="font-mono">{readiness.paystack.webhook_url}</code></p>
            </div>
          </div>

          {/* Flutterwave */}
          <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold">Flutterwave</h2>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${readiness.flutterwave.ready ? 'text-emerald-700' : 'text-amber-700'}`}>
                {readiness.flutterwave.ready ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {readiness.flutterwave.ready ? 'Ready for Checkout' : 'Not Ready (Missing Secret/Config)'}
              </span>
            </div>
            <div className="flex items-center gap-6 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={readiness.flutterwave.enabled}
                  onChange={(e) =>
                    setReadiness({
                      ...readiness,
                      flutterwave: { ...readiness.flutterwave, enabled: e.target.checked },
                    })
                  }
                />
                Enable Flutterwave
              </label>
              <select
                value={readiness.flutterwave.mode}
                onChange={(e) =>
                  setReadiness({
                    ...readiness,
                    flutterwave: { ...readiness.flutterwave, mode: e.target.value as 'test' | 'live' },
                  })
                }
                className="border border-[#101820]/20 px-2.5 py-1 bg-[#FFFFFF]"
              >
                <option value="test">Test Mode</option>
                <option value="live">Live Mode</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Public Key</label>
              <input
                type="text"
                value={readiness.flutterwave.public_key}
                onChange={(e) =>
                  setReadiness({ ...readiness, flutterwave: { ...readiness.flutterwave, public_key: e.target.value } })
                }
                placeholder="FLWPUBK_TEST-..."
                className="w-full border border-[#101820]/20 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div className="text-[11px] text-[#707782] space-y-1">
              <p>Server Secret Key (`FLUTTERWAVE_SECRET_KEY`): {readiness.flutterwave.secret_key_configured ? 'Configured' : 'Not configured in server env'}</p>
              <p>Webhook URL: <code className="font-mono">{readiness.flutterwave.webhook_url}</code></p>
            </div>
          </div>

          {/* Bank Transfer */}
          <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold">Bank Transfer</h2>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={readiness.bank_transfer.enabled}
                  onChange={(e) =>
                    setReadiness({
                      ...readiness,
                      bank_transfer: { ...readiness.bank_transfer, enabled: e.target.checked },
                    })
                  }
                />
                Enable Bank Transfer
              </label>
            </div>
            <input
              type="text"
              placeholder="Bank Name"
              value={readiness.bank_transfer.bank_name}
              onChange={(e) =>
                setReadiness({ ...readiness, bank_transfer: { ...readiness.bank_transfer, bank_name: e.target.value } })
              }
              className="w-full border border-[#101820]/20 px-3 py-2 text-xs"
            />
            <input
              type="text"
              placeholder="Account Name"
              value={readiness.bank_transfer.account_name}
              onChange={(e) =>
                setReadiness({
                  ...readiness,
                  bank_transfer: { ...readiness.bank_transfer, account_name: e.target.value },
                })
              }
              className="w-full border border-[#101820]/20 px-3 py-2 text-xs"
            />
            <input
              type="text"
              placeholder="Account Number"
              value={readiness.bank_transfer.account_number}
              onChange={(e) =>
                setReadiness({
                  ...readiness,
                  bank_transfer: { ...readiness.bank_transfer, account_number: e.target.value },
                })
              }
              className="w-full border border-[#101820]/20 px-3 py-2 text-xs font-mono"
            />
            <textarea
              rows={2}
              placeholder="Transfer instructions"
              value={readiness.bank_transfer.instructions}
              onChange={(e) =>
                setReadiness({
                  ...readiness,
                  bank_transfer: { ...readiness.bank_transfer, instructions: e.target.value },
                })
              }
              className="w-full border border-[#101820]/20 px-3 py-2 text-xs"
            />
          </div>

          {/* Cash on Delivery */}
          <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold">Cash on Delivery</h2>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={readiness.cash_on_delivery.enabled}
                  onChange={(e) =>
                    setReadiness({
                      ...readiness,
                      cash_on_delivery: { ...readiness.cash_on_delivery, enabled: e.target.checked },
                    })
                  }
                />
                Enable Cash on Delivery
              </label>
            </div>
            <textarea
              rows={3}
              placeholder="Delivery payment instructions"
              value={readiness.cash_on_delivery.instructions}
              onChange={(e) =>
                setReadiness({
                  ...readiness,
                  cash_on_delivery: { ...readiness.cash_on_delivery, instructions: e.target.value },
                })
              }
              className="w-full border border-[#101820]/20 px-3 py-2 text-xs"
            />
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider"
              >
                {saving ? 'Saving...' : 'Save Payment Configuration'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Transaction History */}
      <div className="bg-[#FFFFFF] border border-[#101820]/10 overflow-x-auto">
        <div className="p-4 border-b border-[#101820]/10">
          <h2 className="font-serif text-lg font-semibold text-[#101820]">Transaction Ledger</h2>
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#101820]/10 text-[#707782] bg-[#F7F5F0]/60">
              <th className="py-3 px-4">Reference</th>
              <th className="py-3 px-4">Order</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#101820]/5">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#707782]">No transactions recorded yet.</td>
              </tr>
            ) : (
              transactions.map((t) => (
                <tr key={t.id}>
                  <td className="py-3 px-4 font-mono">{t.reference}</td>
                  <td className="py-3 px-4 font-mono">{t.order_number}</td>
                  <td className="py-3 px-4">{t.customer_name}</td>
                  <td className="py-3 px-4 capitalize">{t.provider.replace(/_/g, ' ')}</td>
                  <td className="py-3 px-4 tabular-nums font-semibold">{formatNGN(t.amount_kobo)}</td>
                  <td className="py-3 px-4 capitalize">{t.status.replace(/_/g, ' ')}</td>
                  <td className="py-3 px-4 text-right">
                    {t.status !== 'successful' && (t.provider === 'bank_transfer' || t.provider === 'cash_on_delivery') && (
                      <button
                        type="button"
                        onClick={() => handleManualVerify(t.id)}
                        className="px-3 py-1 bg-[#101820] text-[#FFFFFF] text-[11px] font-semibold"
                      >
                        Confirm Received
                      </button>
                    )}
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
