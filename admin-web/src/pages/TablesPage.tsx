import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout';
import { ApiRequestError } from '../lib/api';
import {
  closeSession,
  fetchOpenSessions,
  fetchTables,
  openTableSession,
  type AdminTable,
} from '../lib/tables';

export function TablesPage() {
  const [tables, setTables] = useState<AdminTable[]>([]);
  const [openSessionByTableId, setOpenSessionByTableId] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinModal, setPinModal] = useState<{ tableNumber: string; pin: string } | null>(null);
  const [busyTableId, setBusyTableId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const [tableList, sessions] = await Promise.all([fetchTables(), fetchOpenSessions()]);
    setTables(tableList);
    const map = new Map<string, string>();
    for (const session of sessions) {
      map.set(session.table.id, session.id);
    }
    setOpenSessionByTableId(map);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        await refresh();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load tables');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const sorted = useMemo(
    () => [...tables].sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true })),
    [tables],
  );

  async function handleOpen(table: AdminTable) {
    setBusyTableId(table.id);
    setError(null);
    try {
      const result = await openTableSession(table.id);
      setPinModal({ tableNumber: table.tableNumber, pin: result.pin });
      await refresh();
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : err instanceof Error ? err.message : 'Could not open table';
      setError(message);
    } finally {
      setBusyTableId(null);
    }
  }

  async function handleClose(table: AdminTable) {
    const sessionId = openSessionByTableId.get(table.id);
    if (!sessionId) {
      return;
    }
    setBusyTableId(table.id);
    setError(null);
    try {
      await closeSession(sessionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close session');
    } finally {
      setBusyTableId(null);
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
  }

  return (
    <AdminLayout
      title="Tables"
      subtitle="Open a session, share the guest link or QR screen with colleagues."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-900"
        >
          Refresh
        </button>
      }
    >
      {loading ? <p className="p-4 text-slate-400">Loading tables…</p> : null}
      {error ? <p className="p-4 text-red-400">{error}</p> : null}

      <main className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((table) => {
          const isOpen = openSessionByTableId.has(table.id);
          const busy = busyTableId === table.id;
          return (
            <article key={table.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-2xl font-bold">Table {table.tableNumber}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    isOpen ? 'bg-emerald-900 text-emerald-200' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isOpen ? 'Open' : 'Closed'}
                </span>
              </div>

              <p className="mt-3 break-all text-sm text-slate-400">{table.customerUrl}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={table.customerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium hover:bg-emerald-600"
                >
                  Open guest menu
                </a>
                <button
                  type="button"
                  onClick={() => void copyLink(table.customerUrl)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-900"
                >
                  Copy link
                </button>
                <Link
                  to={`/tables/${table.id}/qr`}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-900"
                >
                  QR screen
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                {!isOpen ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleOpen(table)}
                    className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    {busy ? 'Opening…' : 'Open table (get PIN)'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleClose(table)}
                    className="rounded-lg border border-red-800 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                  >
                    {busy ? 'Closing…' : 'Close session'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </main>

      {pinModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 text-center">
            <p className="text-sm text-slate-400">Table {pinModal.tableNumber}</p>
            <p className="mt-2 text-sm">Give this PIN to the guest:</p>
            <p className="mt-3 text-4xl font-bold tracking-[0.4em]">{pinModal.pin}</p>
            <button
              type="button"
              className="mt-6 w-full rounded-lg bg-slate-100 py-2 text-slate-900"
              onClick={() => setPinModal(null)}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
