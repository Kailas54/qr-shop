import { FormEvent, useState } from 'react';
import { LanguageToggle, useI18n } from '../../../shared/i18n/index.tsx';
import type { PublicTable } from '../lib/menu';
import { useGuest } from '../guest/GuestContext';
import { ApiRequestError } from '../lib/api';
import { CustomerFrame } from '../components/customer/CustomerShell';

type Props = {
  qrToken: string;
  table: PublicTable;
  onJoined: () => void;
};

export function JoinPage({ qrToken, table, onJoined }: Props) {
  const { join } = useGuest();
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waitingForStaff = table.requireStaffOpen && !table.sessionOpen;

  async function submitJoin(pinValue?: string) {
    setError(null);
    setLoading(true);
    try {
      await join(qrToken, pinValue);
      onJoined();
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not join this table';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitJoin(table.requireStaffOpen ? pin : undefined);
  }

  const pinForm = (
    <form onSubmit={handleSubmit} className="space-y-3 text-start">
      <label className="block text-sm font-medium text-stone-600">
        {t('customer.tablePin')}
        <input
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className="mt-1 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-center text-2xl tracking-[0.4em] text-stone-900 shadow-sm outline-none focus:border-[var(--brand)]"
          placeholder="••••"
          autoComplete="one-time-code"
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading || pin.length !== 4}
        className="w-full rounded-2xl bg-[var(--brand)] py-3.5 font-bold text-white disabled:opacity-50"
      >
        {loading ? t('customer.joining') : t('customer.joinTable')}
      </button>
    </form>
  );

  return (
    <CustomerFrame>
      <div className="flex min-h-[80vh] flex-col justify-center p-6">
        <div className="mb-4 flex justify-center">
          <LanguageToggle />
        </div>
        <div className="mx-auto w-full max-w-sm space-y-5 text-center">
          <p className="text-sm text-stone-500">{t('customer.welcome')}</p>
          <h1 className="text-2xl font-black text-[var(--brand)]">{table.restaurantName}</h1>
          <p className="text-stone-600">{t('common.table')} {table.tableNumber}</p>

          {waitingForStaff ? (
            <>
              <p className="rounded-2xl bg-amber-50 p-4 text-start text-sm text-amber-900 ring-1 ring-amber-200">
                {t('customer.joinWaiting')}
              </p>
              {pinForm}
            </>
          ) : table.requireStaffOpen ? (
            <>
              <p className="text-sm text-stone-500">{t('customer.joinPinHint')}</p>
              {pinForm}
            </>
          ) : (
            <>
              <p className="text-sm text-stone-500">{t('customer.startHint')}</p>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button
                type="button"
                disabled={loading}
                onClick={() => void submitJoin()}
                className="w-full rounded-2xl bg-[var(--brand)] py-3.5 font-bold text-white disabled:opacity-50"
              >
                {loading ? t('customer.starting') : t('customer.startOrdering')}
              </button>
            </>
          )}
        </div>
      </div>
    </CustomerFrame>
  );
}
