import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiRequest } from '../lib/api';

export type GuestSession = {
  qrToken: string;
  accessToken: string;
  sessionId: string;
  expiresAt: string;
  tableNumber: string;
  restaurantName: string;
};

type GuestState = {
  session: GuestSession | null;
  join: (qrToken: string, pin?: string) => Promise<void>;
  restore: (qrToken: string) => Promise<boolean>;
  leave: () => void;
};

const GuestContext = createContext<GuestState | null>(null);

function storageKey(qrToken: string) {
  return `qr-guest:${qrToken}`;
}

function loadSession(qrToken: string): GuestSession | null {
  try {
    const raw = localStorage.getItem(storageKey(qrToken));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as GuestSession;
    if (parsed.qrToken !== qrToken) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(session: GuestSession) {
  localStorage.setItem(storageKey(session.qrToken), JSON.stringify(session));
}

export function GuestProvider({ children, qrToken }: { children: ReactNode; qrToken: string }) {
  const [session, setSession] = useState<GuestSession | null>(() => loadSession(qrToken));

  const leave = useCallback(() => {
    localStorage.removeItem(storageKey(qrToken));
    setSession(null);
  }, [qrToken]);

  const join = useCallback(
    async (token: string, pin?: string) => {
      const body: { qrToken: string; pin?: string } = { qrToken: token };
      if (pin) {
        body.pin = pin;
      }
      const result = await apiRequest<{
        accessToken: string;
        sessionId: string;
        expiresAt: string;
        tableNumber: string;
        restaurantName: string;
      }>('/api/public/sessions/join', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const next: GuestSession = {
        qrToken: token,
        accessToken: result.accessToken,
        sessionId: result.sessionId,
        expiresAt: result.expiresAt,
        tableNumber: result.tableNumber,
        restaurantName: result.restaurantName,
      };
      saveSession(next);
      setSession(next);
    },
    [],
  );

  const restore = useCallback(
    async (token: string) => {
      const stored = loadSession(token);
      if (!stored) {
        setSession(null);
        return false;
      }
      try {
        await apiRequest('/api/public/sessions/me', { token: stored.accessToken });
        setSession(stored);
        return true;
      } catch {
        localStorage.removeItem(storageKey(token));
        setSession(null);
        return false;
      }
    },
    [],
  );

  const value = useMemo(
    () => ({ session, join, restore, leave }),
    [session, join, restore, leave],
  );

  return <GuestContext.Provider value={value}>{children}</GuestContext.Provider>;
}

export function useGuest() {
  const ctx = useContext(GuestContext);
  if (!ctx) {
    throw new Error('useGuest must be used within GuestProvider');
  }
  return ctx;
}
