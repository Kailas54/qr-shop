import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Pusher from 'pusher-js';
import { CartProvider, useCart } from '../cart/CartContext';
import { GuestProvider, useGuest } from '../guest/GuestContext';
import { CartSheet } from '../components/customer/CartSheet';
import {
  BottomNav,
  CategoryStrip,
  CustomerFrame,
  CustomerHeader,
  HeroCarousel,
  PromoBanner,
  SearchBar,
  type NavTab,
} from '../components/customer/CustomerShell';
import { ProductCard } from '../components/customer/ProductCard';
import { ApiRequestError, resolveMediaUrl } from '../lib/api';
import { fetchPublicTable, type MenuCategory, type MenuItem, type PublicTable } from '../lib/menu';
import { orderStatusLabel, useI18n } from '../../../shared/i18n/index.tsx';
import { fetchMyOrders, placeOrder, type GuestOrder } from '../lib/orders';
import { connectSessionPusher, fetchRealtimeConfig } from '../lib/realtime';
import { JoinPage } from './JoinPage';

type RealtimeKey = 'Connecting' | 'Live' | 'Poll' | 'Reconnecting';

function formatMoney(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`;
}

type MenuRow = { item: MenuItem; categoryName: string };

function flattenMenu(categories: MenuCategory[]): MenuRow[] {
  return categories.flatMap((cat) => cat.items.map((item) => ({ item, categoryName: cat.name })));
}

function TableExperience() {
  const { t } = useI18n();
  const { qrToken = '' } = useParams();
  const { session, restore, leave } = useGuest();
  const [table, setTable] = useState<PublicTable | null>(null);
  const [loadingTable, setLoadingTable] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [navTab, setNavTab] = useState<NavTab>('home');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [orders, setOrders] = useState<GuestOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [realtimeKey, setRealtimeKey] = useState<RealtimeKey>('Connecting');
  const realtimeLabel =
    realtimeKey === 'Connecting'
      ? t('customer.realtimeConnecting')
      : realtimeKey === 'Live'
        ? t('customer.realtimeLive')
        : realtimeKey === 'Poll'
          ? t('customer.realtimePoll')
          : t('customer.realtimeReconnecting');
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
      setTableError(err instanceof Error ? err.message : t('customer.tableNotFound'));
    } finally {
      setLoadingTable(false);
    }
  }, [qrToken, t]);

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
        setRealtimeKey('Poll');
        pollTimer = setInterval(() => void refreshOrders(), 20_000);
        return;
      }

      setRealtimeKey('Live');
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
          setRealtimeKey('Reconnecting');
        });
        pusher.connection.bind('connected', () => {
          setRealtimeKey('Live');
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

  const filteredItems = useMemo(() => {
    if (!table) {
      return [];
    }
    const q = search.trim().toLowerCase();
    let rows = flattenMenu(table.menu.categories);
    if (categoryFilter) {
      rows = rows.filter((row) => row.categoryName === categoryFilter);
    }
    if (vegOnly) {
      rows = rows.filter((row) => row.item.isVeg);
    }
    if (q) {
      rows = rows.filter(
        (row) =>
          row.item.name.toLowerCase().includes(q) ||
          (row.item.description?.toLowerCase().includes(q) ?? false) ||
          row.categoryName.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [table, categoryFilter, search, vegOnly]);

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
      setNavTab('orders');
    } catch (err) {
      setSubmitError(err instanceof ApiRequestError ? err.message : 'Could not place order');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingTable) {
    return (
      <CustomerFrame>
        <p className="p-8 text-center text-stone-500">{t('customer.loadingTable')}</p>
      </CustomerFrame>
    );
  }

  if (tableError || !table) {
    return (
      <CustomerFrame>
        <p className="p-8 text-center text-red-600">{tableError ?? t('customer.tableNotFound')}</p>
      </CustomerFrame>
    );
  }

  if (!joined || !session) {
    return <JoinPage qrToken={qrToken} table={table} onJoined={() => setJoined(true)} />;
  }

  const showMenuChrome = navTab === 'home' || navTab === 'menu';

  return (
    <CustomerFrame>
      <div className="pb-28">
        {showMenuChrome ? (
          <>
            <CustomerHeader
              restaurantName={session.restaurantName}
              tableNumber={session.tableNumber}
              cartCount={cart.itemCount}
              onOpenCart={() => setCartOpen(true)}
              onOpenMenu={() => setNavTab('menu')}
            />
            <SearchBar
              value={search}
              onChange={setSearch}
              vegOnly={vegOnly}
              onToggleVeg={() => setVegOnly((v) => !v)}
            />
          </>
        ) : null}

        {navTab === 'home' ? (
          <>
            <HeroCarousel />
            <CategoryStrip
              categories={table.menu.categories}
              selected={categoryFilter}
              onSelect={(name) => {
                setCategoryFilter(name);
                if (name) {
                  setNavTab('menu');
                }
              }}
            />
            <section className="px-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-stone-900">{t('customer.popularPicks')}</h2>
                <button
                  type="button"
                  onClick={() => setNavTab('menu')}
                  className="text-sm font-semibold text-[var(--brand)]"
                >
                  {t('customer.viewAll')}
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {filteredItems.slice(0, 8).map((row, index) => (
                  <ProductCard
                    key={row.item.id}
                    item={row.item}
                    categoryName={row.categoryName}
                    imageUrl={resolveMediaUrl(row.item.imageUrl)}
                    index={index}
                    onAdd={() => cart.addItem(row.item)}
                  />
                ))}
              </div>
            </section>
            <PromoBanner />
          </>
        ) : null}

        {navTab === 'menu' ? (
          <main className="px-4 pt-2">
            <CategoryStrip
              categories={table.menu.categories}
              selected={categoryFilter}
              onSelect={setCategoryFilter}
            />
            {filteredItems.length === 0 ? (
              <p className="py-12 text-center text-stone-500">{t('customer.noDishes')}</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2">
                {filteredItems.map((row, index) => (
                  <ProductCard
                    key={row.item.id}
                    item={row.item}
                    categoryName={row.categoryName}
                    imageUrl={resolveMediaUrl(row.item.imageUrl)}
                    index={index}
                    onAdd={() => cart.addItem(row.item)}
                    layout="grid"
                  />
                ))}
              </div>
            )}
          </main>
        ) : null}

        {navTab === 'orders' ? (
          <main className="space-y-4 p-4 pt-6">
            <div>
              <h2 className="text-xl font-bold text-stone-900">{t('customer.myOrders')}</h2>
              <p className="text-xs text-stone-500">{realtimeLabel}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-stone-500">
                {ordersLoading ? t('common.loading') : t('customer.ordersCount', { count: orders.length })}
              </p>
              <button
                type="button"
                onClick={() => void refreshOrders()}
                className="text-sm font-semibold text-[var(--brand)]"
              >
                {t('common.refresh')}
              </button>
            </div>
            {orders.length === 0 ? (
              <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
                <p className="text-stone-500">{t('customer.noOrders')}</p>
                <button
                  type="button"
                  onClick={() => setNavTab('home')}
                  className="mt-4 rounded-full bg-[var(--brand)] px-6 py-2 text-sm font-semibold text-white"
                >
                  {t('customer.browseMenu')}
                </button>
              </div>
            ) : (
              orders.map((order) => (
                <article key={order.id} className="rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-stone-900">{orderStatusLabel(t, order.status)}</p>
                    <p className="text-sm font-semibold text-[var(--brand)]">{formatMoney(order.total)}</p>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-stone-600">
                    {order.items.map((line) => (
                      <li key={`${order.id}-${line.menuItemId}`}>
                        {line.quantity}× {line.name}
                      </li>
                    ))}
                  </ul>
                  {order.notes ? (
                    <p className="mt-2 text-xs text-amber-700">{t('customer.notePrefix')} {order.notes}</p>
                  ) : null}
                </article>
              ))
            )}
          </main>
        ) : null}

        {navTab === 'offers' ? (
          <main className="space-y-4 p-4 pt-6">
            <h2 className="text-xl font-bold text-stone-900">{t('customer.offersTitle')}</h2>
            <HeroCarousel />
            <PromoBanner />
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-600">{t('customer.offersBody')}</p>
            </div>
          </main>
        ) : null}

        {navTab === 'profile' ? (
          <main className="space-y-4 p-4 pt-6">
            <h2 className="text-xl font-bold text-stone-900">{t('customer.profileTitle')}</h2>
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">{t('customer.restaurant')}</p>
              <p className="text-lg font-bold">{session.restaurantName}</p>
              <p className="mt-3 text-sm text-stone-500">{t('common.table')}</p>
              <p className="text-lg font-bold">{session.tableNumber}</p>
              <p className="mt-3 text-xs text-stone-400">{realtimeLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                leave();
                setJoined(false);
              }}
              className="w-full rounded-2xl border-2 border-[var(--brand)] py-3 font-semibold text-[var(--brand)]"
            >
              {t('customer.leaveTable')}
            </button>
          </main>
        ) : null}
      </div>

      {cart.itemCount > 0 && !cartOpen ? (
        <div className="fixed inset-x-0 bottom-[5.5rem] z-20 mx-auto max-w-lg px-4">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-[var(--brand)] px-5 py-3.5 font-bold text-white shadow-lg"
          >
            <span>{t('customer.viewCart', { count: cart.itemCount })}</span>
            <span>{formatMoney(cart.subtotal)}</span>
          </button>
        </div>
      ) : null}

      <BottomNav tab={navTab} onChange={setNavTab} />

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        submitting={submitting}
        submitError={submitError}
        onPlaceOrder={() => void handlePlaceOrder()}
      />
    </CustomerFrame>
  );
}

function InvalidQr() {
  const { t } = useI18n();
  return (
    <CustomerFrame>
      <p className="p-8 text-center text-red-600">{t('customer.invalidQr')}</p>
    </CustomerFrame>
  );
}

export function TablePage() {
  const { qrToken = '' } = useParams();
  if (!qrToken) {
    return <InvalidQr />;
  }

  return (
    <GuestProvider qrToken={qrToken}>
      <CartProvider>
        <TableExperience />
      </CartProvider>
    </GuestProvider>
  );
}
