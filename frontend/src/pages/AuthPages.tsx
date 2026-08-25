// Login + Register pages (phone + password, UAE format).
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Smartphone, UserPlus, LogIn } from 'lucide-react';
import { api, friendlyError, sessionTokens } from '../lib/api';
import { useT } from '../i18n';
import { useAuth, toast } from '../store';
import { Spinner } from '../components/ui';

function usePasswordToggle() {
  const [show, setShow] = useState(false);
  const btn = () => (
    <button
      type="button"
      onClick={() => setShow(!show)}
      className="absolute end-3 top-1/2 -translate-y-1/2 text-ink/35 hover:text-ink/60"
      aria-label={show ? 'Hide password' : 'Show password'}
    >
      {show ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
  return { show, btn };
}

export function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const { setCustomer } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const { btn } = usePasswordToggle();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post<{ id: number; name: string; phone: string; email: string | null; token?: string }>('/api/auth/login', { phone, password });
      if (res.token) sessionTokens.setCustomer(res.token);
      setCustomer(res);
      toast.success(`Welcome back, ${res.name}!`);
      navigate('/account');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 md:py-16">
      <div className="text-center mb-8">
        <span className="inline-flex h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 items-center justify-center mb-3">
          <LogIn size={26} />
        </span>
        <h1 className="text-2xl font-extrabold">{t('page.login.title')}</h1>
      </div>
      <form onSubmit={submit} className="card p-6 grid gap-4">
        <div>
          <label className="label">{t('auth.phone')}</label>
          <div className="relative">
            <Smartphone size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
            <input className="input !ps-10" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XXXXXXXX" inputMode="tel" required />
          </div>
        </div>
        <div>
          <label className="label">{t('auth.password')}</label>
          <div className="relative">
            <input className="input !pe-10" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
            {btn()}
          </div>
        </div>
        <button className="btn-primary w-full !py-3" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />} {t('auth.loginCta')}
        </button>
        <p className="text-center text-sm text-ink/55">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-brand-700 font-bold hover:underline">{t('auth.registerCta')}</Link>
        </p>
        <p className="text-center text-xs text-ink/40">
          {t('auth.forgot')} — contact us on WhatsApp and we will reset it securely.
        </p>
      </form>
    </div>
  );
}

export function RegisterPage() {
  const t = useT();
  const navigate = useNavigate();
  const { setCustomer } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error(t('auth.passwordHint'));
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ id: number; name: string; phone: string; email: string | null; token?: string }>('/api/auth/register', form);
      if (res.token) sessionTokens.setCustomer(res.token);
      setCustomer(res);
      toast.success(`Welcome, ${res.name}!`);
      navigate('/account');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 md:py-16">
      <div className="text-center mb-8">
        <span className="inline-flex h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 items-center justify-center mb-3">
          <UserPlus size={26} />
        </span>
        <h1 className="text-2xl font-extrabold">{t('page.register.title')}</h1>
        <p className="text-sm text-ink/50 mt-1.5">{t('auth.registerNote')}</p>
      </div>
      <form onSubmit={submit} className="card p-6 grid gap-4">
        <div>
          <label className="label">{t('auth.name')}</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
        </div>
        <div>
          <label className="label">{t('auth.phone')}</label>
          <div className="relative">
            <Smartphone size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
            <input className="input !ps-10" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05XXXXXXXX" inputMode="tel" required />
          </div>
        </div>
        <div>
          <label className="label">{t('auth.email')}</label>
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">{t('auth.password')}</label>
          <div className="relative">
            <input className="input !pe-10" type={show ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
            <button type="button" onClick={() => setShow(!show)} className="absolute end-3 top-1/2 -translate-y-1/2 text-ink/35 hover:text-ink/60" aria-label="Toggle password">
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <p className="text-[11px] text-ink/40 mt-1">{t('auth.passwordHint')}</p>
        </div>
        <button className="btn-primary w-full !py-3" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />} {t('auth.registerCta')}
        </button>
        <p className="text-center text-sm text-ink/55">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="text-brand-700 font-bold hover:underline">{t('auth.loginCta')}</Link>
        </p>
      </form>
    </div>
  );
}
