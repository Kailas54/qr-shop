import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Pusher from 'pusher-js';
import { useCart } from '../../cart/CartContext';
import { useGuest } from '../../guest/GuestContext';
import type { NavTab } from '../../components/customer/CustomerShell';
import { ApiRequestError, resolveMediaUrl } from '../../lib/api';
import { fetchPublicTable, type PublicTable } from '../../lib/menu';
import { useI18n } from '../../../../shared/i18n/index.tsx';
import { fetchMyOrders, placeOrder, type GuestOrder } from '../../lib/orders';
import { connectSessionPusher, fetchRealtimeConfig } from '../../lib/realtime';
import { flattenMenu, type MenuRow } from './menuUtils';

type RealtimeKey = 'Connecting' | 'Live' | 'Poll' | 'Reconnecting';

export function useTableSession() {
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

  const filteredItems = useMemo((): MenuRow[] => {
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

  const groupedByCategory = useMemo(() => {
    if (!table) {
      return [];
    }
    const names = categoryFilter
      ? [categoryFilter]
      : table.menu.categories.map((c) => c.name);
    return names
      .map((name) => ({
        name,
        rows: filteredItems.filter((row) => row.categoryName === name),
      }))
      .filter((group) => group.rows.length > 0);
  }, [table, categoryFilter, filteredItems]);

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

  function leaveTable() {
    leave();
    setJoined(false);
  }

  return {
    qrToken,
    t,
    table,
    loadingTable,
    tableError,
    joined,
    setJoined,
    session,
    navTab,
    setNavTab,
    categoryFilter,
    setCategoryFilter,
    search,
    setSearch,
    vegOnly,
    setVegOnly,
    orders,
    ordersLoading,
    realtimeLabel,
    cartOpen,
    setCartOpen,
    submitting,
    submitError,
    cart,
    filteredItems,
    groupedByCategory,
    refreshOrders,
    handlePlaceOrder,
    leaveTable,
    resolveMediaUrl,
  };
}

export type TableSession = ReturnType<typeof useTableSession>;
