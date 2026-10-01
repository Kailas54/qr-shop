import { useCallback, useEffect, useMemo, useState } from 'react';
import Pusher from 'pusher-js';
import { useAuth } from '../auth/AuthContext';
import { AdminLayout } from '../components/AdminLayout';
import { wakeDatabase } from '../lib/api';
import { ensureNotificationPermission, notifyNewOrder, playNewOrderChime } from '../lib/alert';
import {
  BoardOrder,
  confirmOrder,
  connectRestaurantPusher,
  fetchBoardOrders,
  fetchOrderDetail,
  fetchRealtimeConfig,
  patchOrderStatus,
  type OrderAuditEvent,
} from '../lib/realtime';

const COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'pending_confirmation', label: 'Confirm' },
  { key: 'placed', label: 'Placed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'served', label: 'Served' },
];

function formatMoney(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`;
}

function minutesSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / 60_000));
}

function upsertOrder(list: BoardOrder[], order: BoardOrder) {
  const index = list.findIndex((item) => item.id === order.id);
  if (index === -1) {
    return [order, ...list];
  }
  const next = [...list];
  next[index] = order;
  return next;
}

function mapCreatedPayload(payload: Record<string, unknown>, existing?: BoardOrder): BoardOrder {
  return {
    id: String(payload.orderId),
    status: String(payload.status),
    tableNumber: String(payload.tableNumber),
    sessionId: String(payload.sessionId),
    total: Number(payload.total),
    notes: String(payload.notes ?? ''),
    flaggedForReview: Boolean(payload.flaggedForReview),
    createdAt: String(payload.createdAt ?? new Date().toISOString()),
    updatedAt: String(payload.createdAt ?? new Date().toISOString()),
    items:
      existing?.items ??
      (Array.isArray(payload.items)
        ? payload.items.map((item) => {
            const row = item as Record<string, unknown>;
            return {
              name: String(row.name),
              quantity: Number(row.quantity),
              unitPrice: Number(row.price),
            };
          })
        : []),
  };
}

export function OrdersBoardPage() {
  const { accessToken, user } = useAuth();
  const staffRole = user?.role ?? '';
  const [orders, setOrders] = useState<BoardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeLabel, setRealtimeLabel] = useState('Connecting…');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [audit, setAudit] = useState<{ orderId: string; events: OrderAuditEvent[] } | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const canCancel = staffRole !== 'kitchen';
  const canMarkPaid = staffRole === 'owner' || staffRole === 'manager';
  const canConfirm = staffRole !== 'kitchen';

  function applyOrderUpdate(updated: BoardOrder) {
    if (updated.status === 'paid' || updated.status === 'cancelled') {
      setOrders((current) => current.filter((row) => row.id !== updated.id));
      return;
    }
    setOrders((current) => upsertOrder(current, updated));
  }

  const refresh = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    const result = await fetchBoardOrders();
    setOrders(result.orders);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !user) {
      return;
    }

    let pusher: Pusher | null = null;
    let cancelled = false;

    async function boot() {
      const staff = user;
      if (!accessToken || !staff) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        await wakeDatabase();
        await ensureNotificationPermission();
        await refresh();
        const config = await fetchRealtimeConfig();
        if (cancelled) {
          return;
        }
        if (!config.enabled) {
          setRealtimeLabel('REST only (Pusher not configured)');
          return;
        }
        setRealtimeLabel('Live via Pusher');
        pusher = connectRestaurantPusher(staff.restaurantId, config, {
          onOrderCreated: (payload) => {
            const row = mapCreatedPayload(payload as Record<string, unknown>);
            setOrders((current) => upsertOrder(current, row));
            setHighlightId(row.id);
            playNewOrderChime();
            notifyNewOrder(row.tableNumber);
            setTimeout(() => setHighlightId(null), 8000);
          },
          onOrderUpdated: (payload) => {
            const data = payload as Record<string, unknown>;
            setOrders((current) => {
              const existing = current.find((order) => order.id === data.orderId);
              if (!existing) {
                return current;
              }
              const updated: BoardOrder = {
                ...existing,
                status: String(data.toStatus),
                updatedAt: String(data.updatedAt ?? new Date().toISOString()),
              };
              if (updated.status === 'paid' || updated.status === 'cancelled') {
                return current.filter((row) => row.id !== updated.id);
              }
              return upsertOrder(current, updated);
            });
          },
        });
        pusher?.connection.bind('connected', () => refresh());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load board');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
      pusher?.disconnect();
    };
  }, [accessToken, refresh, user]);

  const grouped = useMemo(() => {
    const map = new Map<string, BoardOrder[]>();
    for (const column of COLUMNS) {
      map.set(column.key, []);
    }
    for (const order of orders) {
      const bucket = map.get(order.status);
      if (bucket) {
        bucket.push(order);
      }
    }
    return map;
  }, [orders]);

  async function advance(order: BoardOrder, status: string) {
    if (!accessToken) {
      return;
    }
    const result = await patchOrderStatus(order.id, status);
    applyOrderUpdate(result.order);
  }

  async function confirm(order: BoardOrder) {
    if (!accessToken) {
      return;
    }
    const result = await confirmOrder(order.id);
    applyOrderUpdate(result.order);
  }

  async function cancelOrder(order: BoardOrder) {
    if (!accessToken) {
      return;
    }
    const result = await patchOrderStatus(order.id, 'cancelled');
    applyOrderUpdate(result.order);
  }

  async function openAudit(orderId: string) {
    setAuditLoading(true);
    try {
      const detail = await fetchOrderDetail(orderId);
      setAudit({ orderId, events: detail.events });
    } finally {
      setAuditLoading(false);
    }
  }

  return (
    <AdminLayout
      title="Orders board"
      subtitle={realtimeLabel}
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
      {loading ? <p className="p-4 text-slate-400">Loading orders…</p> : null}
      {error ? <p className="p-4 text-red-400">{error}</p> : null}

      <main className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((column) => (
          <section key={column.key} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <h2 className="mb-3 text-sm font-medium text-slate-300">{column.label}</h2>
            <div className="space-y-3">
              {(grouped.get(column.key) ?? []).map((order) => (
                <article
                  key={order.id}
                  className={`rounded-lg border p-3 ${
                    highlightId === order.id
                      ? 'border-emerald-400 bg-emerald-950/40'
                      : 'border-slate-800 bg-slate-950'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-2xl font-bold leading-none">T{order.tableNumber}</p>
                    <span className="text-xs text-slate-400">{minutesSince(order.createdAt)}m</span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{formatMoney(order.total)}</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
                    {order.items.map((item) => (
                      <li key={`${order.id}-${item.name}`}>
                        {item.quantity}× {item.name}
                      </li>
                    ))}
                  </ul>
                  {order.notes ? <p className="mt-2 text-xs text-amber-300">Note: {order.notes}</p> : null}
                  {order.flaggedForReview ? (
                    <p className="mt-2 text-xs text-orange-400">High value — review</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
                      onClick={() => void openAudit(order.id)}
                    >
                      History
                    </button>
                    {order.status === 'pending_confirmation' && canConfirm ? (
                      <button
                        type="button"
                        className="rounded bg-emerald-700 px-2 py-1 text-xs"
                        onClick={() => void confirm(order)}
                      >
                        Confirm
                      </button>
                    ) : null}
                    {order.status === 'pending_confirmation' && canCancel ? (
                      <button
                        type="button"
                        className="rounded bg-red-900 px-2 py-1 text-xs"
                        onClick={() => void cancelOrder(order)}
                      >
                        Reject
                      </button>
                    ) : null}
                    {order.status === 'placed' ? (
                      <button
                        type="button"
                        className="rounded bg-blue-700 px-2 py-1 text-xs"
                        onClick={() => void advance(order, 'accepted')}
                      >
                        Accept
                      </button>
                    ) : null}
                    {order.status === 'accepted' ? (
                      <button
                        type="button"
                        className="rounded bg-violet-700 px-2 py-1 text-xs"
                        onClick={() => void advance(order, 'preparing')}
                      >
                        Preparing
                      </button>
                    ) : null}
                    {order.status === 'preparing' ? (
                      <button
                        type="button"
                        className="rounded bg-teal-700 px-2 py-1 text-xs"
                        onClick={() => void advance(order, 'served')}
                      >
                        Served
                      </button>
                    ) : null}
                    {order.status === 'served' && canMarkPaid ? (
                      <button
                        type="button"
                        className="rounded bg-amber-700 px-2 py-1 text-xs"
                        onClick={() => void advance(order, 'paid')}
                      >
                        Mark paid
                      </button>
                    ) : null}
                    {order.status !== 'pending_confirmation' && canCancel ? (
                      <button
                        type="button"
                        className="rounded border border-red-800 px-2 py-1 text-xs text-red-300"
                        onClick={() => void cancelOrder(order)}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>

      {audit || auditLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">Order history</h3>
              <button
                type="button"
                className="text-sm text-slate-400"
                onClick={() => setAudit(null)}
              >
                Close
              </button>
            </div>
            {auditLoading ? <p className="mt-4 text-sm text-slate-400">Loading…</p> : null}
            {audit ? (
              <ul className="mt-4 space-y-3 text-sm">
                {audit.events.map((event) => (
                  <li key={event.id} className="border-l-2 border-slate-700 pl-3">
                    <p className="font-medium">
                      {event.fromStatus ? `${event.fromStatus} → ${event.toStatus}` : event.toStatus}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(event.createdAt).toLocaleString()}
                      {event.changedBy ? ` · ${event.changedBy.name}` : ' · System'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
