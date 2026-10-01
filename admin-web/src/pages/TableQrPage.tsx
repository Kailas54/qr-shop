import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../../../shared/i18n/index.tsx';
import { AdminLayout } from '../components/AdminLayout';
import { fetchTables, loadTableQrObjectUrl } from '../lib/tables';

export function TableQrPage() {
  const { t } = useI18n();
  const { tableId = '' } = useParams();
  const [customerUrl, setCustomerUrl] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const tables = await fetchTables();
        const table = tables.find((row) => row.id === tableId);
        if (!table) {
          setError('Table not found');
          return;
        }
        if (cancelled) {
          return;
        }
        setCustomerUrl(table.customerUrl);
        setTableNumber(table.tableNumber);
        objectUrl = await loadTableQrObjectUrl(tableId);
        if (!cancelled) {
          setQrUrl(objectUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load QR');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [tableId]);

  return (
    <AdminLayout
      title={
        tableNumber
          ? `${t('common.table')} ${tableNumber} — ${t('admin.qrScreen')}`
          : t('admin.tableQr')
      }
      subtitle={t('admin.tableQrSubtitle')}
      actions={
        <Link
          to="/tables"
          className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50"
        >
          {t('admin.allTables')}
        </Link>
      }
    >
      {error ? <p className="p-6 text-red-600">{error}</p> : null}

      {!error && customerUrl ? (
        <div className="mx-auto flex max-w-lg flex-col items-center gap-6 p-6 text-center">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt={`QR code for table ${tableNumber}`}
              className="rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
              width={280}
              height={280}
            />
          ) : (
            <p className="text-stone-500">{t('admin.loadingQr')}</p>
          )}

          <a
            href={customerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-2xl bg-[var(--brand)] px-6 py-4 text-lg font-bold text-white shadow-md"
          >
            {t('admin.openCustomerMenu')}
          </a>

          <p className="break-all text-sm text-stone-500">{customerUrl}</p>

          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(customerUrl)}
            className="text-sm font-semibold text-[var(--brand)] underline"
          >
            {t('admin.copyGuestLink')}
          </button>
        </div>
      ) : null}
    </AdminLayout>
  );
}
