// Premium admin login — with 2FA support, rate-limit friendly UX.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, KeyRound } from 'lucide-react';
import { api, friendlyError, sessionTokens } from '../lib/api';
import { useAuth, toast } from '../store';
import { Spinner } from '../components/ui';

export function AdminLogin() {
  const navigate = useNavigate();
  const { setAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [requiresTotp, setRequiresTotp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post<{
        requiresTotp?: boolean;
        admin?: { id: number; name: string; email: string; role: string; totpEnabled: boolean };
        token?: string;
      }>('/api/admin/auth/login', {
        email,
        password,
        ...(requiresTotp ? { totpCode: totp } : {}),
      });
      if (res.requiresTotp) {
        setRequiresTotp(true);
      } else if (res.admin) {
        if (res.token) sessionTokens.setAdmin(res.token); // header-auth mode
        setAdmin(res.admin as never);
        toast.success(`Welcome, ${res.admin.name}`);
        navigate('/admin');
      }
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-32 -start-32 h-96 w-96 rounded-full bg-gold-500/10" />
      <div className="absolute -bottom-40 -end-40 h-[30rem] w-[30rem] rounded-full bg-gold-500/10" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <span className="inline-flex h-16 w-16 rounded-3xl bg-gold-500 text-ink font-extrabold text-2xl items-center justify-center shadow-lift mb-4">
            V
          </span>
          <h1 className="text-2xl font-extrabold text-white">Virexamart Admin</h1>
          <p className="text-white/50 text-sm mt-1">Sign in to manage your store</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-3xl shadow-2xl p-7 grid gap-4">
          <div>
            <label className="label" htmlFor="admin-email">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
              <input
                id="admin-email"
                className="input !ps-10"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                placeholder="admin@yourstore.com"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="admin-password">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
              <input
                id="admin-password"
                className="input !ps-10 !pe-10"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button type="button" className="absolute end-3 top-1/2 -translate-y-1/2 text-ink/35 hover:text-ink/60" onClick={() => setShowPw(!showPw)} aria-label="Show password">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {requiresTotp && (
            <div className="animate-fade-in">
              <label className="label" htmlFor="admin-totp">Authenticator code</label>
              <div className="relative">
                <KeyRound size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
                <input
                  id="admin-totp"
                  className="input !ps-10"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value)}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>
            </div>
          )}
          <button className="btn-primary w-full !py-3.5" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : <ShieldCheck size={17} />}
            {requiresTotp ? 'Verify & Sign In' : 'Sign In'}
          </button>
          <p className="text-center text-[11px] text-ink/40">
            Protected by session authentication, rate limiting and audit logging.
          </p>
        </form>

        <p className="text-center text-white/40 text-xs mt-6">
          Demo admin: admin@desertcart.ae / Admin@12345 — change before going live
        </p>
      </div>
    </div>
  );
}
