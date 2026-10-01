import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

export function AdminLayout({ title, subtitle, children, actions }: Props) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-300">QR Ordering</span>
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-sm ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`
              }
              end
            >
              Orders
            </NavLink>
            <NavLink
              to="/tables"
              className={({ isActive }) =>
                `text-sm ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`
              }
            >
              Tables
            </NavLink>
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">{user?.name}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-700 px-3 py-1.5 hover:bg-slate-900"
            >
              Log out
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      </header>
      {children}
    </div>
  );
}
