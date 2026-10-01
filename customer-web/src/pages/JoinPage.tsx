import { FormEvent, useState } from 'react';
import type { PublicTable } from '../lib/menu';
import { useGuest } from '../guest/GuestContext';
import { ApiRequestError } from '../lib/api';

type Props = {
  qrToken: string;
  table: PublicTable;
  onJoined: () => void;
};

export function JoinPage({ qrToken, table, onJoined }: Props) {
  const { join } = useGuest();
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

  if (waitingForStaff) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">{table.restaurantName}</h1>
        <p className="text-stone-400">Table {table.tableNumber}</p>
        <p className="rounded-xl border border-amber-800/60 bg-amber-950/40 p-4 text-sm text-amber-100">
          Your table is not open yet. Please ask a staff member to start your session, then enter the
          PIN they give you.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          <label className="block text-sm text-stone-300">
            Table PIN
            <input
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-lg tracking-[0.3em]"
              placeholder="••••"
              autoComplete="one-time-code"
            />
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading || pin.length !== 4}
            className="w-full rounded-lg bg-emerald-600 py-2.5 font-medium disabled:opacity-50"
          >
            {loading ? 'Joining…' : 'Join table'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{table.restaurantName}</h1>
        <p className="text-stone-400">Table {table.tableNumber}</p>
      </div>

      {table.requireStaffOpen ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm text-stone-400">Enter the 4-digit PIN from your server to start ordering.</p>
          <label className="block text-sm text-stone-300">
            Table PIN
            <input
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-lg tracking-[0.3em]"
              placeholder="••••"
              autoComplete="one-time-code"
            />
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading || pin.length !== 4}
            className="w-full rounded-lg bg-emerald-600 py-2.5 font-medium disabled:opacity-50"
          >
            {loading ? 'Joining…' : 'Join & view menu'}
          </button>
        </form>
      ) : (
        <>
          <p className="text-sm text-stone-400">Tap below to open the menu and place an order.</p>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="button"
            disabled={loading}
            onClick={() => void submitJoin()}
            className="w-full rounded-lg bg-emerald-600 py-2.5 font-medium disabled:opacity-50"
          >
            {loading ? 'Starting…' : 'Start ordering'}
          </button>
        </>
      )}
    </div>
  );
}
