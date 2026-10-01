import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest, bootstrapStaffSession } from '../lib/api';
import { registerAuthBridge, type StaffUser } from './sessionBridge';

export type { StaffUser };

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: StaffUser | null;
  sessionReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const STORAGE_KEY = 'qr-admin-auth';

const AuthContext = createContext<AuthState | null>(null);

function loadStored(): Pick<AuthState, 'accessToken' | 'refreshToken' | 'user'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { accessToken: null, refreshToken: null, user: null };
    }
    return JSON.parse(raw) as Pick<AuthState, 'accessToken' | 'refreshToken' | 'user'>;
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = loadStored();
  const [accessToken, setAccessToken] = useState<string | null>(() => stored.accessToken);
  const [refreshToken, setRefreshToken] = useState<string | null>(() => stored.refreshToken);
  const [user, setUser] = useState<StaffUser | null>(() => stored.user);
  const [sessionReady, setSessionReady] = useState(() => !stored.refreshToken);

  const persist = (next: { accessToken: string; refreshToken: string; user: StaffUser }) => {
    setAccessToken(next.accessToken);
    setRefreshToken(next.refreshToken);
    setUser(next.user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const clearSession = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  useEffect(() => {
    registerAuthBridge({
      getAccessToken: () => accessToken,
      getRefreshToken: () => refreshToken,
      applyTokens: (nextAccess, nextRefresh, nextUser) => {
        persist({ accessToken: nextAccess, refreshToken: nextRefresh, user: nextUser });
      },
      clearSession,
    });
    return () => registerAuthBridge(null);
  }, [accessToken, refreshToken, user]);

  useEffect(() => {
    if (!stored.refreshToken) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const result = await bootstrapStaffSession(stored.refreshToken!);
      if (cancelled) {
        return;
      }
      if (result) {
        persist({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.admin,
        });
      } else {
        clearSession();
      }
      setSessionReady(true);
    })();

    return () => {
      cancelled = true;
    };
    // Refresh stored session once on initial load (expired access tokens in localStorage).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      accessToken,
      refreshToken,
      user,
      sessionReady,
      async login(email, password) {
        const result = await apiRequest<{
          accessToken: string;
          refreshToken: string;
          admin: StaffUser;
        }>('/api/admin/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        persist({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.admin,
        });
      },
      logout() {
        clearSession();
      },
    }),
    [accessToken, refreshToken, sessionReady, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
