import { CartSheet } from '../../components/customer/CartSheet';
import {
  BottomNav,
  CategoryStrip,
  CustomerFrame,
  CustomerHeader,
  HeroCarousel,
  PromoBanner,
  SearchBar,
} from '../../components/customer/CustomerShell';
import { ProductCard } from '../../components/customer/ProductCard';
import { orderStatusLabel } from '../../../../shared/i18n/index.tsx';
import { JoinPage } from '../JoinPage';
import { DesignSwitcher } from './DesignSwitcher';
import { formatMoneyDetailed } from './menuUtils';
import type { TableSession } from './useTableSession';

export function TableExperienceClassic(state: TableSession) {
  const {
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
    refreshOrders,
    handlePlaceOrder,
    leaveTable,
    resolveMediaUrl,
  } = state;

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
      <DesignSwitcher qrToken={qrToken} variant="classic" />
      <div className="pb-28 pt-12">
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
                    <p className="text-sm font-semibold text-[var(--brand)]">{formatMoneyDetailed(order.total)}</p>
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
              onClick={leaveTable}
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
            <span>{formatMoneyDetailed(cart.subtotal)}</span>
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
