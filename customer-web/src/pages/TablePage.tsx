import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Pusher from 'pusher-js';
import { CartProvider, useCart } from '../cart/CartContext';
import { GuestProvider, useGuest } from '../guest/GuestContext';
import { ApiRequestError, resolveMediaUrl } from '../lib/api';
import { fetchPublicTable, type MenuItem, type PublicTable } from '../lib/menu';
import { ORDER_STATUS_LABELS, fetchMyOrders, placeOrder, type GuestOrder } from '../lib/orders';
import { connectSessionPusher, fetchRealtimeConfig } from '../lib/realtime';
import { JoinPage } from './JoinPage';

function formatMoney(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`;
}

function TableExperience() {
  const { qrToken = '' } = useParams();
  const { session, restore, leave } = useGuest();
  const [table, setTable] = useState<PublicTable | null>(null);
  const [loadingTable, setLoadingTable] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [tab, setTab] = useState<'menu' | 'orders'>('menu');
  const [orders, setOrders] = useState<GuestOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [realtimeLabel, setRealtimeLabel] = useState('Connecting…');
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const cart = useCart();

  const loadTable = useCallback(async () => {
    setLoadingTable(true);
    setTableError(null);
    try {
      const data = await fetchPublicTable(qrToken);
      setTable(data);
    } catch (err) {
      setTableError(err instanceof Error ? err.message : 'Table not found');
    } finally {
      setLoadingTable(false);
    }
  }, [qrToken]);

  useEffect(() => {
    void loadTable();
  }, [loadTable]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await restore(qrToken);
      if (!cancelled && ok) {
        setJoined(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qrToken, restore]);

  const refreshOrders = useCallback(async () => {
    if (!session) {
      return;
    }
    setOrdersLoading(true);
    try {
      const list = await fetchMyOrders(session.accessToken);
      setOrders(list);
    } finally {
      setOrdersLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!joined || !session) {
      return;
    }

    let pusher: Pusher | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    void (async () => {
      await refreshOrders();
      const config = await fetchRealtimeConfig();
      if (cancelled) {
        return;
      }
      if (!config.enabled) {
        setRealtimeLabel('Updates every 20s');
        pollTimer = setInterval(() => void refreshOrders(), 20_000);
        return;
      }

      setRealtimeLabel('Live updates');
      pusher = connectSessionPusher(session.accessToken, session.sessionId, config, (payload) => {
        setOrders((current) =>
          current.map((order) =>
            order.id === payload.orderId
              ? { ...order, status: payload.status, createdAt: order.createdAt }
              : order,
          ),
        );
      });
      if (pusher) {
        pusher.connection.bind('disconnected', () => {
          setRealtimeLabel('Reconnecting…');
        });
        pusher.connection.bind('connected', () => {
          setRealtimeLabel('Live updates');
          void refreshOrders();
        });
      }
      pollTimer = setInterval(() => {
        if (pusher?.connection.state !== 'connected') {
          void refreshOrders();
        }
      }, 20_000);
    })();

    return () => {
      cancelled = true;
      pusher?.disconnect();
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, [joined, session, refreshOrders]);

  async function handlePlaceOrder() {
    if (!session || cart.lines.length === 0) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const idempotencyKey = `order-${crypto.randomUUID()}`;
    try {
      const order = await placeOrder(
        session.accessToken,
        {
          notes: cart.notes.trim(),
          items: cart.lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
        },
        idempotencyKey,
      );
      cart.clear();
      setCartOpen(false);
      setOrders((current) => [order, ...current.filter((row) => row.id !== order.id)]);
      setTab('orders');
    } catch (err) {
      setSubmitError(err instanceof ApiRequestError ? err.message : 'Could not place order');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingTable) {
    return <p className="p-6 text-stone-400">Loading table…</p>;
  }

  if (tableError || !table) {
    return <p className="p-6 text-red-400">{tableError ?? 'Table not found'}</p>;
  }

  if (!joined || !session) {
    return <JoinPage qrToken={qrToken} table={table} onJoined={() => setJoined(true)} />;
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 border-b border-stone-800 bg-stone-950/95 px-4 py-3 backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">{session.restaurantName}</h1>
            <p className="text-xs text-stone-400">
              Table {session.tableNumber} · {realtimeLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              leave();
              setJoined(false);
            }}
            className="text-xs text-stone-400 underline"
          >
            Leave
          </button>
        </div>
        <nav className="mt-3 flex gap-2">
          {(['menu', 'orders'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full px-4 py-1.5 text-sm ${
                tab === key ? 'bg-stone-100 text-stone-900' : 'bg-stone-800 text-stone-300'
              }`}
            >
              {key === 'menu' ? 'Menu' : 'My orders'}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'menu' ? (
        <main className="space-y-6 p-4">
          {table.menu.categories.map((category) => (
            <section key={category.name}>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-stone-400">
                {category.name}
              </h2>
              <ul className="space-y-3">
                {category.items.map((item) => (
                  <MenuRow key={item.id} item={item} onAdd={() => cart.addItem(item)} />
                ))}
              </ul>
            </section>
          ))}
        </main>
      ) : (
        <main className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-stone-400">{ordersLoading ? 'Refreshing…' : `${orders.length} order(s)`}</p>
            <button
              type="button"
              onClick={() => void refreshOrders()}
              className="text-sm text-emerald-400 underline"
            >
              Refresh
            </button>
          </div>
          {orders.length === 0 ? (
            <p className="text-stone-500">No orders yet. Add items from the menu.</p>
          ) : (
            orders.map((order) => (
              <article key={order.id} className="rounded-xl border border-stone-800 bg-stone-900/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{ORDER_STATUS_LABELS[order.status] ?? order.status}</p>
                  <p className="text-sm text-stone-400">{formatMoney(order.total)}</p>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-stone-300">
                  {order.items.map((line) => (
                    <li key={`${order.id}-${line.menuItemId}`}>
                      {line.quantity}× {line.name}
                    </li>
                  ))}
                </ul>
                {order.notes ? <p className="mt-2 text-xs text-amber-300">Note: {order.notes}</p> : null}
              </article>
            ))
          )}
        </main>
      )}

      {cart.itemCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-800 bg-stone-950 p-4">
          {!cartOpen ? (
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="flex w-full items-center justify-between rounded-xl bg-emerald-600 px-4 py-3 font-medium"
            >
              <span>View cart ({cart.itemCount})</span>
              <span>{formatMoney(cart.subtotal)}</span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Your cart</h3>
                <button type="button" className="text-sm text-stone-400" onClick={() => setCartOpen(false)}>
                  Close
                </button>
              </div>
              <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                {cart.lines.map((line) => (
                  <li key={line.menuItemId} className="flex items-center justify-between gap-2">
                    <span className="flex-1">
                      {line.isVeg ? '🟢' : '🔴'} {line.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-8 w-8 rounded border border-stone-700"
                        onClick={() => cart.setQuantity(line.menuItemId, line.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="w-6 text-center">{line.quantity}</span>
                      <button
                        type="button"
                        className="h-8 w-8 rounded border border-stone-700"
                        onClick={() => cart.setQuantity(line.menuItemId, line.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <label className="block text-sm text-stone-400">
                Notes for kitchen
                <textarea
                  value={cart.notes}
                  onChange={(e) => cart.setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100"
                  placeholder="Optional"
                />
              </label>
              {submitError ? <p className="text-sm text-red-400">{submitError}</p> : null}
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handlePlaceOrder()}
                className="w-full rounded-xl bg-emerald-600 py-3 font-semibold disabled:opacity-50"
              >
                {submitting ? 'Placing order…' : `Place order · ${formatMoney(cart.subtotal)}`}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MenuRow({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  const image = resolveMediaUrl(item.imageUrl);
  return (
    <li className="flex gap-3 rounded-xl border border-stone-800 bg-stone-900/40 p-3">
      {image ? (
        <img src={image} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-stone-800 text-xs text-stone-500">
          No photo
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">
            {item.isVeg ? '🟢 ' : '🔴 '}
            {item.name}
          </p>
          <p className="shrink-0 text-sm">{formatMoney(item.price)}</p>
        </div>
        {item.description ? <p className="mt-1 text-sm text-stone-400">{item.description}</p> : null}
        <button
          type="button"
          disabled={!item.isAvailable}
          onClick={onAdd}
          className="mt-2 rounded-lg bg-stone-100 px-3 py-1 text-sm font-medium text-stone-900 disabled:opacity-40"
        >
          {item.isAvailable ? 'Add' : 'Unavailable'}
        </button>
      </div>
    </li>
  );
}

export function TablePage() {
  const { qrToken = '' } = useParams();
  if (!qrToken) {
    return <p className="p-6 text-red-400">Invalid QR link</p>;
  }

  return (
    <GuestProvider qrToken={qrToken}>
      <CartProvider>
        <TableExperience />
      </CartProvider>
    </GuestProvider>
  );
}
