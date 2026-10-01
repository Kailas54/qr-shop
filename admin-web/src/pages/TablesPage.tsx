import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../../shared/i18n/index.tsx';
import { useAuth } from '../auth/AuthContext';
import { AdminLayout } from '../components/AdminLayout';
import { ApiRequestError } from '../lib/api';
import { canManageMenuAndTables } from '../lib/permissions';
import {
  closeSession,
  createTable,
  fetchOpenSessions,
  fetchTables,
  openTableSession,
  updateTable,
  type AdminTable,
} from '../lib/tables';

export function TablesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canEdit = canManageMenuAndTables(user?.role);
  const [tables, setTables] = useState<AdminTable[]>([]);
  const [openSessionByTableId, setOpenSessionByTableId] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinModal, setPinModal] = useState<{ tableNumber: string; pin: string } | null>(null);
  const [busyTableId, setBusyTableId] = useState<string | null>(null);
  const [tableModal, setTableModal] = useState<null | { mode: 'create' } | { mode: 'edit'; table: AdminTable }>(null);
  const [savingTable, setSavingTable] = useState(false);

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

  async function handleTableSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const tableNumber = String(form.get('tableNumber') ?? '').trim();
    const isActive = form.get('isActive') === 'on';
    if (!tableNumber) {
      return;
    }
    setSavingTable(true);
    setError(null);
    try {
      if (tableModal?.mode === 'edit') {
        await updateTable(tableModal.table.id, { tableNumber, isActive });
      } else {
        await createTable(tableNumber, isActive);
      }
      setTableModal(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : err instanceof Error ? err.message : t('admin.saveFailed'));
    } finally {
      setSavingTable(false);
    }
  }

  return (
    <AdminLayout
      title={t('admin.tablesTitle')}
      subtitle={t('admin.tablesSubtitle')}
      actions={
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <button
              type="button"
              onClick={() => setTableModal({ mode: 'create' })}
              className="rounded-xl bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white"
            >
              {t('admin.addTable')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50"
          >
            {t('common.refresh')}
          </button>
        </div>
      }
    >
      {loading ? <p className="p-4 text-stone-500">{t('admin.loadingTables')}</p> : null}
      {error ? <p className="p-4 text-red-600">{error}</p> : null}

      <main className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((table) => {
          const isOpen = openSessionByTableId.has(table.id);
          const busy = busyTableId === table.id;
          return (
            <article key={table.id} className="rounded-3xl border border-stone-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-2xl font-bold text-stone-900">{t('common.table')} {table.tableNumber}</h2>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isOpen ? 'bg-red-50 text-[var(--brand)]' : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {isOpen ? t('admin.sessionOpen') : t('admin.sessionClosed')}
                  </span>
                  {!table.isActive ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      {t('admin.tableInactive')}
                    </span>
                  ) : null}
                </div>
              </div>

              <p className="mt-3 break-all text-sm text-stone-500">{table.customerUrl}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={table.customerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white"
                >
                  {t('admin.openGuestMenu')}
                </a>
                <button
                  type="button"
                  onClick={() => void copyLink(table.customerUrl)}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700"
                >
                  {t('admin.copyLink')}
                </button>
                <Link
                  to={`/tables/${table.id}/qr`}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700"
                >
                  {t('admin.qrScreen')}
                </Link>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => setTableModal({ mode: 'edit', table })}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700"
                  >
                    {t('admin.edit')}
                  </button>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                {!isOpen ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleOpen(table)}
                    className="rounded-xl bg-stone-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? t('admin.opening') : t('admin.openTable')}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleClose(table)}
                    className="rounded-xl border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-50"
                  >
                    {busy ? t('admin.closing') : t('admin.closeSession')}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </main>

      {tableModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
            <h3 className="font-bold text-stone-900">
              {tableModal.mode === 'edit' ? t('admin.editTable') : t('admin.addTable')}
            </h3>
            <form onSubmit={(e) => void handleTableSubmit(e)} className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-stone-600">
                {t('admin.tableNumber')}
                <input
                  name="tableNumber"
                  required
                  maxLength={32}
                  defaultValue={tableModal.mode === 'edit' ? tableModal.table.tableNumber : ''}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  name="isActive"
                  type="checkbox"
                  defaultChecked={tableModal.mode === 'edit' ? tableModal.table.isActive : true}
                />
                {t('admin.tableActive')}
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTableModal(null)}
                  className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-medium"
                >
                  {t('common.close')}
                </button>
                <button
                  type="submit"
                  disabled={savingTable}
                  className="flex-1 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {t('admin.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {pinModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-xl">
            <p className="text-sm text-stone-500">{t('common.table')} {pinModal.tableNumber}</p>
            <p className="mt-2 text-sm text-stone-700">{t('admin.pinGive')}</p>
            <p className="mt-3 text-4xl font-bold tracking-[0.4em] text-[var(--brand)]">{pinModal.pin}</p>
            <button
              type="button"
              className="mt-6 w-full rounded-2xl bg-[var(--brand)] py-2.5 font-bold text-white"
              onClick={() => setPinModal(null)}
            >
              {t('common.done')}
            </button>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
