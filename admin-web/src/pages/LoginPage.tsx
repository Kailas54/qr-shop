import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LanguageToggle, useI18n } from '../../../shared/i18n/index.tsx';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { accessToken, login } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('owner@demo.local');
  const [password, setPassword] = useState('Owner@12345');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-app flex min-h-screen items-center justify-center bg-[var(--bg-cream)] p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-3xl border border-stone-200/80 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
      >
        <div className="mb-4 flex justify-end">
          <LanguageToggle />
        </div>
        <h1 className="text-xl font-bold text-stone-900">{t('admin.staffLogin')}</h1>
        <p className="mt-1 text-sm text-stone-500">{t('admin.liveBoard')}</p>
        <label className="mt-6 block text-sm font-medium text-stone-600">
          {t('admin.email')}
          <input
            className="mt-1 w-full rounded-2xl border border-stone-200 bg-[var(--bg-cream)] px-3 py-2.5 outline-none focus:border-[var(--brand)]"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-stone-600">
          {t('admin.password')}
          <input
            className="mt-1 w-full rounded-2xl border border-stone-200 bg-[var(--bg-cream)] px-3 py-2.5 outline-none focus:border-[var(--brand)]"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-2xl bg-[var(--brand)] py-3 font-bold text-white disabled:opacity-60"
        >
          {loading ? t('admin.signingIn') : t('admin.signIn')}
        </button>
      </form>
    </div>
  );
}
