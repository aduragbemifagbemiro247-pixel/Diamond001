import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { apiFetch } from '../../types/store';
import { SeoHead } from '../../components/common/SeoHead';

export const AdminLoginPage: React.FC = () => {
  const { admin, loading, refreshAdmin } = useAdminAuth();
  const navigate = useNavigate();

  const [bootstrapStatus, setBootstrapStatus] = useState<{
    initialized: boolean;
    secret_configured: boolean;
  } | null>(null);

  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ initialized: boolean; secret_configured: boolean }>('/api/admin/bootstrap-status')
      .then(setBootstrapStatus)
      .catch(() => setBootstrapStatus({ initialized: true, secret_configured: false }));
  }, []);

  if (!loading && admin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const verified = await refreshAdmin();
      if (!verified) {
        setError(
          'Your credentials are valid, but your browser blocked the session cookie in this embedded frame. Open the Admin Portal in a direct browser tab or allow cookies for this preview.'
        );
        return;
      }
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiFetch('/api/admin/bootstrap', {
        method: 'POST',
        body: JSON.stringify({
          bootstrap_secret: bootstrapSecret,
          full_name: fullName,
          email,
          password,
        }),
      });
      const verified = await refreshAdmin();
      if (!verified) {
        setError(
          'Super Admin created, but your browser blocked the session cookie in this embedded frame. Open the Admin Portal in a direct browser tab to sign in.'
        );
        return;
      }
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bootstrap initialization failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const needsBootstrap = bootstrapStatus && !bootstrapStatus.initialized;

  return (
    <>
      <SeoHead
        title="Staff Portal — Diamond Store"
        description="Authorized staff authentication for Diamond Store Administration."
      />
      <div className="min-h-screen bg-[#101820] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#FFFFFF] border border-[#D6B875]/30 p-8">
          <div className="text-center pb-6 border-b border-[#101820]/10">
            <p className="font-serif text-xl tracking-[0.18em] font-semibold text-[#101820]">DIAMOND STORE</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#707782]">
              {needsBootstrap ? 'Initial Super Admin Setup' : 'Staff Administration Portal'}
            </p>
          </div>

          {error && (
            <div className="mt-5 p-3.5 bg-red-50 border border-red-200 text-xs text-red-800 space-y-2">
              <p>{error}</p>
              {error.includes('blocked the session cookie') && (
                <a
                  href="/admin/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block font-semibold underline text-[#101820]"
                >
                  Open Staff Portal in New Tab &rarr;
                </a>
              )}
            </div>
          )}

          {!bootstrapStatus ? (
            <p className="py-10 text-center text-xs text-[#707782]">Checking initialization status...</p>
          ) : needsBootstrap ? (
            <div className="mt-6 space-y-4">
              <div className="p-3.5 bg-[#F7F5F0] border border-[#101820]/10 text-xs text-[#101820] space-y-1.5">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-[#B5954F]" />
                  <span>One-Time Super Admin Bootstrap</span>
                </div>
                <p className="text-[#707782]">
                  No Super Admin exists yet. Provide the server&apos;s <code className="font-mono">ADMIN_BOOTSTRAP_SECRET</code> environment
                  variable to create the initial Super Admin account. This endpoint locks permanently once completed.
                </p>
                {!bootstrapStatus.secret_configured && (
                  <p className="text-red-700 font-medium pt-1">
                    Notice: ADMIN_BOOTSTRAP_SECRET (min 12 characters) is not yet set in server environment variables.
                  </p>
                )}
              </div>

              <form onSubmit={handleBootstrap} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Bootstrap Secret *</label>
                  <input
                    type="password"
                    required
                    value={bootstrapSecret}
                    onChange={(e) => setBootstrapSecret(e.target.value)}
                    placeholder="From ADMIN_BOOTSTRAP_SECRET env var"
                    className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#101820]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Super Admin Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Admin Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Password (min 10 chars) *</label>
                  <input
                    type="password"
                    required
                    minLength={10}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider hover:bg-[#101820]/90 disabled:opacity-50"
                >
                  {submitting ? 'Initializing...' : 'Initialize Super Admin'}
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Staff Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-[#101820]/20 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#101820]"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-[#101820] text-[#FFFFFF] text-xs font-semibold uppercase tracking-wider hover:bg-[#101820]/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Lock className="w-3.5 h-3.5 text-[#D6B875]" />
                <span>{submitting ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-[#101820]/10 text-center">
            <Link to="/" className="text-xs text-[#707782] hover:text-[#101820]">
              &larr; Return to Public Storefront
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};
