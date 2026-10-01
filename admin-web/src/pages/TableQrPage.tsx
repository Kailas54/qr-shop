import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout';
import { fetchTables, loadTableQrObjectUrl } from '../lib/tables';

export function TableQrPage() {
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
      title={tableNumber ? `Table ${tableNumber} — QR` : 'Table QR'}
      subtitle="Share this screen in a meeting or open the link on your phone."
      actions={
        <Link to="/tables" className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-900">
          ← All tables
        </Link>
      }
    >
      {error ? <p className="p-6 text-red-400">{error}</p> : null}

      {!error && customerUrl ? (
        <div className="mx-auto flex max-w-lg flex-col items-center gap-6 p-6 text-center">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt={`QR code for table ${tableNumber}`}
              className="rounded-2xl bg-white p-4 shadow-lg"
              width={280}
              height={280}
            />
          ) : (
            <p className="text-slate-400">Loading QR…</p>
          )}

          <a
            href={customerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-lg font-semibold hover:bg-emerald-500"
          >
            Open customer menu
          </a>

          <p className="break-all text-sm text-slate-400">{customerUrl}</p>

          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(customerUrl)}
            className="text-sm text-slate-300 underline"
          >
            Copy guest link
          </button>
        </div>
      ) : null}
    </AdminLayout>
  );
}
