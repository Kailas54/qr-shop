import { useCallback, useEffect, useMemo, useState } from 'react';
import Pusher from 'pusher-js';
import { useI18n } from '../../../shared/i18n/index.tsx';
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
  const { t } = useI18n();
  const { accessToken, user } = useAuth();
  const staffRole = user?.role ?? '';
  const columns = useMemo(
    () => [
      { key: 'pending_confirmation', label: t('admin.columnConfirm') },
      { key: 'placed', label: t('admin.columnPlaced') },
      { key: 'accepted', label: t('admin.columnAccepted') },
      { key: 'preparing', label: t('admin.columnPreparing') },
      { key: 'served', label: t('admin.columnServed') },
    ],
    [t],
  );
  const [orders, setOrders] = useState<BoardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeMode, setRealtimeMode] = useState<'rest' | 'live' | 'loading'>('loading');
  const realtimeLabel =
    realtimeMode === 'loading'
      ? t('common.loading')
      : realtimeMode === 'live'
        ? t('admin.realtimePusher')
        : t('admin.realtimeRest');
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
          setRealtimeMode('rest');
          return;
        }
        setRealtimeMode('live');
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
    for (const column of columns) {
      map.set(column.key, []);
    }
    for (const order of orders) {
      const bucket = map.get(order.status);
      if (bucket) {
        bucket.push(order);
      }
    }
    return map;
  }, [orders, columns]);

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
      title={t('admin.ordersBoard')}
      subtitle={realtimeLabel}
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50"
        >
          {t('common.refresh')}
        </button>
      }
    >
      {loading ? <p className="p-4 text-stone-500">{t('admin.loadingOrders')}</p> : null}
      {error ? <p className="p-4 text-red-600">{error}</p> : null}

      <main className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
        {columns.map((column) => (
          <section key={column.key} className="rounded-2xl border border-stone-200/80 bg-white p-3 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-stone-700">{column.label}</h2>
            <div className="space-y-3">
              {(grouped.get(column.key) ?? []).map((order) => (
                <article
                  key={order.id}
                  className={`rounded-2xl border p-3 ${
                    highlightId === order.id
                      ? 'border-[var(--brand)] bg-red-50'
                      : 'border-stone-200 bg-[var(--bg-cream)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-2xl font-bold leading-none">T{order.tableNumber}</p>
                    <span className="text-xs text-stone-500">{minutesSince(order.createdAt)}m</span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{formatMoney(order.total)}</p>
                  <ul className="mt-2 space-y-1 text-sm text-stone-600">
                    {order.items.map((item) => (
                      <li key={`${order.id}-${item.name}`}>
                        {item.quantity}× {item.name}
                      </li>
                    ))}
                  </ul>
                  {order.notes ? (
                    <p className="mt-2 text-xs text-amber-700">{t('admin.notePrefix')} {order.notes}</p>
                  ) : null}
                  {order.flaggedForReview ? (
                    <p className="mt-2 text-xs text-orange-600">{t('admin.highValue')}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700"
                      onClick={() => void openAudit(order.id)}
                    >
                      {t('admin.history')}
                    </button>
                    {order.status === 'pending_confirmation' && canConfirm ? (
                      <button
                        type="button"
                        className="rounded-lg bg-[var(--brand)] px-2 py-1 text-xs font-semibold text-white"
                        onClick={() => void confirm(order)}
                      >
                        {t('admin.confirm')}
                      </button>
                    ) : null}
                    {order.status === 'pending_confirmation' && canCancel ? (
                      <button
                        type="button"
                        className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white"
                        onClick={() => void cancelOrder(order)}
                      >
                        {t('admin.reject')}
                      </button>
                    ) : null}
                    {order.status === 'placed' ? (
                      <button
                        type="button"
                        className="rounded-lg bg-[var(--brand)] px-2 py-1 text-xs font-semibold text-white"
                        onClick={() => void advance(order, 'accepted')}
                      >
                        {t('admin.accept')}
                      </button>
                    ) : null}
                    {order.status === 'accepted' ? (
                      <button
                        type="button"
                        className="rounded-lg bg-stone-800 px-2 py-1 text-xs font-semibold text-white"
                        onClick={() => void advance(order, 'preparing')}
                      >
                        {t('admin.preparing')}
                      </button>
                    ) : null}
                    {order.status === 'preparing' ? (
                      <button
                        type="button"
                        className="rounded-lg bg-stone-800 px-2 py-1 text-xs font-semibold text-white"
                        onClick={() => void advance(order, 'served')}
                      >
                        {t('admin.served')}
                      </button>
                    ) : null}
                    {order.status === 'served' && canMarkPaid ? (
                      <button
                        type="button"
                        className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-semibold text-white"
                        onClick={() => void advance(order, 'paid')}
                      >
                        {t('admin.markPaid')}
                      </button>
                    ) : null}
                    {order.status !== 'pending_confirmation' && canCancel ? (
                      <button
                        type="button"
                        className="rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-700"
                        onClick={() => void cancelOrder(order)}
                      >
                        {t('admin.cancel')}
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
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-3xl border border-stone-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-stone-900">{t('admin.orderHistory')}</h3>
              <button
                type="button"
                className="text-sm font-medium text-stone-500"
                onClick={() => setAudit(null)}
              >
                {t('common.close')}
              </button>
            </div>
            {auditLoading ? <p className="mt-4 text-sm text-stone-500">{t('common.loading')}</p> : null}
            {audit ? (
              <ul className="mt-4 space-y-3 text-sm">
                {audit.events.map((event) => (
                  <li key={event.id} className="border-s-2 border-[var(--brand)] ps-3">
                    <p className="font-medium text-stone-800">
                      {event.fromStatus ? `${event.fromStatus} → ${event.toStatus}` : event.toStatus}
                    </p>
                    <p className="text-xs text-stone-500">
                      {new Date(event.createdAt).toLocaleString()}
                      {event.changedBy ? ` · ${event.changedBy.name}` : ` · ${t('common.system')}`}
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
