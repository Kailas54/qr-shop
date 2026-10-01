import { NavLink } from 'react-router-dom';
import { LanguageToggle, useI18n } from '../../../shared/i18n/index.tsx';
import { useAuth } from '../auth/AuthContext';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

export function AdminLayout({ title, subtitle, children, actions }: Props) {
  const { user, logout } = useAuth();
  const { t } = useI18n();

  return (
    <div className="admin-app mx-auto min-h-screen max-w-7xl bg-[var(--bg-cream)]">
      <header className="border-b border-stone-200/80 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-black text-[var(--brand)]">{t('admin.brand')}</span>
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-sm font-semibold ${isActive ? 'text-[var(--brand)]' : 'text-stone-500 hover:text-stone-800'}`
              }
              end
            >
              {t('admin.orders')}
            </NavLink>
            <NavLink
              to="/menu"
              className={({ isActive }) =>
                `text-sm font-semibold ${isActive ? 'text-[var(--brand)]' : 'text-stone-500 hover:text-stone-800'}`
              }
            >
              {t('admin.menu')}
            </NavLink>
            <NavLink
              to="/tables"
              className={({ isActive }) =>
                `text-sm font-semibold ${isActive ? 'text-[var(--brand)]' : 'text-stone-500 hover:text-stone-800'}`
              }
            >
              {t('admin.tables')}
            </NavLink>
          </nav>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <LanguageToggle />
            <span className="text-stone-500">{user?.name}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 font-medium text-stone-700 shadow-sm hover:bg-stone-50"
            >
              {t('admin.logout')}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-stone-900">{title}</h1>
            {subtitle ? <p className="text-xs text-stone-500">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      </header>
      {children}
    </div>
  );
}
