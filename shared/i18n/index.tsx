import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ar } from './locales/ar';
import { en } from './locales/en';
import type { MessageTree } from './locales/en';

export type Locale = 'en' | 'ar';

const messages: Record<Locale, MessageTree> = { en: en as MessageTree, ar };

const STORAGE_KEY = 'qr-locale';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dir: 'ltr' | 'rtl';
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readPath(obj: unknown, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function applyVars(text: string, vars?: Record<string, string | number>) {
  if (!vars) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'ar' || stored === 'en' ? stored : 'en';
  });

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const primary = readPath(messages[locale], key);
      const fallback = readPath(messages.en, key);
      return applyVars(primary ?? fallback ?? key, vars);
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      dir: locale === 'ar' ? 'rtl' : 'ltr',
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within LocaleProvider');
  }
  return ctx;
}

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  return (
    <div
      className={`inline-flex overflow-hidden rounded-xl border border-stone-200 bg-white text-xs font-semibold shadow-sm ${className}`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={`px-3 py-1.5 transition-colors ${locale === 'en' ? 'bg-[var(--brand)] text-white' : 'text-stone-600 hover:bg-stone-50'}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale('ar')}
        className={`px-3 py-1.5 transition-colors ${locale === 'ar' ? 'bg-[var(--brand)] text-white' : 'text-stone-600 hover:bg-stone-50'}`}
      >
        عربي
      </button>
    </div>
  );
}

export function orderStatusLabel(t: I18nContextValue['t'], status: string) {
  return t(`orderStatus.${status}` as string) !== `orderStatus.${status}`
    ? t(`orderStatus.${status}`)
    : status;
}
