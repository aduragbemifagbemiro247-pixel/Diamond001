import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../types/store';
import { useStore } from '../../context/StoreContext';
import { useAdminAuth } from '../../context/AdminAuthContext';

export const AdminSettingsPage: React.FC = () => {
  const { notify, refreshStorefront } = useStore();
  const { admin } = useAdminAuth();
  const [settings, setSettings] = useState<{
    general: {
      store_name: string;
      store_logo_text: string;
      location: string;
      currency: string;
      timezone: string;
      business_email: string;
      business_phone: string;
      whatsapp_number: string;
      social_links: { instagram: string; x: string; facebook: string };
    };
    delivery: {
      nigeria_enabled: boolean;
      international_enabled: boolean;
      default_fee_kobo: number;
      default_payable_on_arrival: boolean;
      notes: string;
    };
    returns: {
      enabled: boolean;
      deadline_days: number;
      conditions: string;
    };
    stock: {
      default_low_stock_threshold: number;
      reservation_minutes: number;
    };
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ settings: NonNullable<typeof settings> }>('/api/admin/settings')
      .then((res) => setSettings(res.settings))
      .catch((err) => notify(err instanceof Error ? err.message : 'Unable to load settings.', 'error'));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          general: settings.general,
          delivery: settings.delivery,
          returns: settings.returns,
          stock: settings.stock,
        }),
      });
      notify('Store settings updated.', 'success');
      refreshStorefront();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return <p className="text-xs text-[#707782]">Loading store settings...</p>;
  }

  const readOnly = admin?.role !== 'super_admin';

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#101820]">Store Settings</h1>
        <p className="text-xs text-[#707782] mt-1">
          Configure official contact details, social links, Africa/Lagos timezone, delivery defaults, and return policy.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* General */}
        <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
          <h2 className="font-serif text-lg font-semibold">General &amp; Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Store Name</label>
              <input
                type="text"
                disabled={readOnly}
                value={settings.general.store_name}
                onChange={(e) =>
                  setSettings({ ...settings, general: { ...settings.general, store_name: e.target.value } })
                }
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Wordmark Logo Text</label>
              <input
                type="text"
                disabled={readOnly}
                value={settings.general.store_logo_text}
                onChange={(e) =>
                  setSettings({ ...settings, general: { ...settings.general, store_logo_text: e.target.value } })
                }
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Business Location</label>
              <input
                type="text"
                disabled={readOnly}
                value={settings.general.location}
                onChange={(e) =>
                  setSettings({ ...settings, general: { ...settings.general, location: e.target.value } })
                }
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Timezone</label>
              <input
                type="text"
                disabled={readOnly}
                value={settings.general.timezone}
                onChange={(e) =>
                  setSettings({ ...settings, general: { ...settings.general, timezone: e.target.value } })
                }
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Business Email (Optional)</label>
              <input
                type="email"
                disabled={readOnly}
                value={settings.general.business_email}
                onChange={(e) =>
                  setSettings({ ...settings, general: { ...settings.general, business_email: e.target.value } })
                }
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Business Phone (Optional)</label>
              <input
                type="tel"
                disabled={readOnly}
                value={settings.general.business_phone}
                onChange={(e) =>
                  setSettings({ ...settings, general: { ...settings.general, business_phone: e.target.value } })
                }
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">WhatsApp Number (Optional)</label>
              <input
                type="tel"
                disabled={readOnly}
                value={settings.general.whatsapp_number}
                onChange={(e) =>
                  setSettings({ ...settings, general: { ...settings.general, whatsapp_number: e.target.value } })
                }
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Instagram URL</label>
              <input
                type="url"
                disabled={readOnly}
                value={settings.general.social_links?.instagram || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    general: {
                      ...settings.general,
                      social_links: { ...settings.general.social_links, instagram: e.target.value },
                    },
                  })
                }
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Delivery & Stock */}
        <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
          <h2 className="font-serif text-lg font-semibold">Delivery &amp; Inventory Rules</h2>
          <div className="flex flex-wrap gap-6 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={settings.delivery.default_payable_on_arrival}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    delivery: { ...settings.delivery, default_payable_on_arrival: e.target.checked },
                  })
                }
              />
              Delivery fees payable on delivery day by default
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Default Low Stock Threshold</label>
              <input
                type="number"
                disabled={readOnly}
                value={settings.stock.default_low_stock_threshold}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    stock: { ...settings.stock, default_low_stock_threshold: Number(e.target.value) },
                  })
                }
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Online Payment Reservation Expiry (Minutes)</label>
              <input
                type="number"
                disabled={readOnly}
                value={settings.stock.reservation_minutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    stock: { ...settings.stock, reservation_minutes: Number(e.target.value) },
                  })
                }
                className="w-full border border-[#101820]/20 px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Return Policy (Super Admin Controlled) */}
        <div className="bg-[#FFFFFF] border border-[#101820]/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Return Policy Configuration</h2>
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={settings.returns.enabled}
                onChange={(e) =>
                  setSettings({ ...settings, returns: { ...settings.returns, enabled: e.target.checked } })
                }
              />
              Enable Customer Returns
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Return Deadline (Days)</label>
            <input
              type="number"
              min={0}
              disabled={readOnly}
              value={settings.returns.deadline_days}
              onChange={(e) =>
                setSettings({ ...settings, returns: { ...settings.returns, deadline_days: Number(e.target.value) } })
              }
              className="w-40 border border-[#101820]/20 px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Return Conditions</label>
            <textarea
              rows={3}
              disabled={readOnly}
              value={settings.returns.conditions}
              onChange={(e) =>
                setSettings({ ...settings, returns: { ...settings.returns, conditions: e.target.value } })
              }
              className="w-full border border-[#101820]/20 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {!readOnly && (
          <button
            type="submit"
            disabled={saving}
            className="px-7 py-3 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider"
          >
            {saving ? 'Saving...' : 'Save Store Settings'}
          </button>
        )}
      </form>
    </div>
  );
};
