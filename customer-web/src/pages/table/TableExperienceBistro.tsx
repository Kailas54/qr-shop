import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CartSheet } from '../../components/customer/CartSheet';
import { FoodImage } from '../../components/customer/FoodImage';
import { IconBag, IconSearch } from '../../components/customer/icons';
import { HERO_IMAGES, categoryImage, menuItemImage } from '../../lib/productImages';
import { LanguageToggle, orderStatusLabel, useI18n } from '../../../../shared/i18n/index.tsx';
import { JoinPage } from '../JoinPage';
import { DesignSwitcher } from './DesignSwitcher';
import { formatMoney, formatMoneyDetailed } from './menuUtils';
import type { TableSession } from './useTableSession';

type BistroTab = 'menu' | 'search' | 'orders';

export function TableExperienceBistro(state: TableSession) {
  const {
    qrToken,
    t,
    table,
    loadingTable,
    tableError,
    joined,
    setJoined,
    session,
    categoryFilter,
    setCategoryFilter,
    search,
    setSearch,
    orders,
    ordersLoading,
    realtimeLabel,
    cartOpen,
    setCartOpen,
    submitting,
    submitError,
    cart,
    groupedByCategory,
    filteredItems,
    refreshOrders,
    handlePlaceOrder,
    resolveMediaUrl,
  } = state;

  const { locale, dir } = useI18n();
  const [tab, setTab] = useState<BistroTab>('menu');
  const searchRef = useRef<HTMLInputElement>(null);

  const offerSlides = useMemo(() => {
    const fromMenu = filteredItems.slice(0, 3).map((row) => ({
      tag: t('customer.bistroSpecialOffer'),
      title: row.item.name,
      subtitle: row.item.description ?? t('customer.bistroLimitedTime'),
      image: menuItemImage(row.item, row.categoryName, resolveMediaUrl(row.item.imageUrl)),
    }));
    if (fromMenu.length >= 2) {
      return fromMenu;
    }
    return [
      {
        tag: t('customer.bistroSpecialOffer'),
        title: session?.restaurantName ?? t('customer.bistroWelcome'),
        subtitle: t('customer.bistroLimitedTime'),
        image: HERO_IMAGES[0],
      },
      {
        tag: t('customer.bistroOffer'),
        title: t('customer.exclusiveOffer'),
        subtitle: t('customer.offerText'),
        image: HERO_IMAGES[1],
      },
    ];
  }, [filteredItems, resolveMediaUrl, session?.restaurantName, t]);

  useEffect(() => {
    if (tab === 'search') {
      searchRef.current?.focus();
    }
  }, [tab]);

  if (loadingTable) {
    return (
      <BistroFrame dir={dir}>
        <p className="p-8 text-center text-stone-500">{t('customer.loadingTable')}</p>
      </BistroFrame>
    );
  }

  if (tableError || !table) {
    return (
      <BistroFrame dir={dir}>
        <p className="p-8 text-center text-red-600">{tableError ?? t('customer.tableNotFound')}</p>
      </BistroFrame>
    );
  }

  if (!joined || !session) {
    return <JoinPage qrToken={qrToken} table={table} onJoined={() => setJoined(true)} />;
  }

  const categories = table.menu.categories;

  return (
    <BistroFrame dir={dir}>
      <DesignSwitcher qrToken={qrToken} variant="bistro" />
      <div className="pb-24 pt-12">
        <header className="flex items-center gap-2 px-4 py-3">
          <LanguageToggle className="shrink-0 scale-[0.92] origin-start" />
          <h1 className="bistro-serif min-w-0 flex-1 text-center text-lg font-semibold leading-snug text-stone-900">
            {session.restaurantName}
          </h1>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center text-stone-700"
            aria-label={t('common.cart')}
          >
            <IconBag className="h-6 w-6" />
            {cart.itemCount > 0 ? (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--bistro-brand)] px-1 text-[9px] font-bold text-white">
                {cart.itemCount > 9 ? '9+' : cart.itemCount}
              </span>
            ) : null}
          </button>
        </header>

        {tab === 'menu' || tab === 'search' ? (
          <>
            <div className="flex gap-3 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {offerSlides.map((slide, index) => (
                <article
                  key={`${slide.title}-${index}`}
                  className="relative h-36 w-[min(85vw,280px)] shrink-0 overflow-hidden rounded-2xl bg-stone-200"
                >
                  <FoodImage src={slide.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4">
                    <span className="inline-block rounded-md bg-white px-2 py-0.5 text-[10px] font-bold tracking-wide text-stone-900">
                      {slide.tag}
                    </span>
                    <p className="mt-2 line-clamp-1 text-sm font-bold text-white">{slide.title}</p>
                    <p className="line-clamp-1 text-xs text-white/85">{slide.subtitle}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="px-4 pb-3">
              <label className="relative flex items-center">
                <IconSearch className="pointer-events-none absolute start-4 h-5 w-5 text-stone-400" />
                <input
                  ref={searchRef}
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('customer.bistroSearchPlaceholder')}
                  className="w-full rounded-full border border-stone-200 bg-white py-3 ps-12 pe-4 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-[var(--bistro-brand)]"
                />
              </label>
            </div>

            <div className="flex gap-6 overflow-x-auto border-b border-stone-200 px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <CategoryTab
                label={t('customer.bistroAllItems')}
                active={categoryFilter === null}
                onClick={() => setCategoryFilter(null)}
              />
              {categories.map((cat) => (
                <CategoryTab
                  key={cat.name}
                  label={cat.name}
                  active={categoryFilter === cat.name}
                  onClick={() => setCategoryFilter(cat.name)}
                />
              ))}
            </div>

            <main className="px-4 pt-4">
              {groupedByCategory.length === 0 ? (
                <p className="py-12 text-center text-stone-500">{t('customer.noDishes')}</p>
              ) : (
                groupedByCategory.map((group) => (
                  <section key={group.name} className="mb-8">
                    <p className="bistro-category-label text-[11px] font-semibold uppercase tracking-widest text-stone-400">
                      {group.name}
                    </p>
                    <h2 className="bistro-serif mt-0.5 text-2xl font-semibold text-stone-900">{group.name}</h2>
                    <ul className="mt-3 space-y-4">
                      {group.rows.map((row) => {
                        const img = menuItemImage(
                          row.item,
                          row.categoryName,
                          resolveMediaUrl(row.item.imageUrl),
                        );
                        return (
                          <li
                            key={row.item.id}
                            className="flex gap-3 border-b border-stone-100 pb-4 last:border-0"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1.5 font-semibold text-stone-900">
                                <span
                                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                                    row.item.isVeg ? 'bg-emerald-600' : 'bg-[var(--bistro-brand)]'
                                  }`}
                                  aria-hidden
                                />
                                {row.item.name}
                              </p>
                              {row.item.description ? (
                                <p className="mt-1 line-clamp-2 text-sm text-stone-500">{row.item.description}</p>
                              ) : null}
                              <p className="mt-2 text-sm font-semibold text-stone-800">
                                {formatMoney(row.item.price)}
                                <span className="font-normal text-stone-500"> / {t('customer.bistroPortion')}</span>
                              </p>
                            </div>
                            <div className="flex w-[88px] shrink-0 flex-col items-stretch">
                              <div className="overflow-hidden rounded-xl border border-stone-100 bg-stone-50">
                                <FoodImage
                                  src={img}
                                  fallback={categoryImage(row.categoryName)}
                                  alt={row.item.name}
                                  className="aspect-square h-[72px] w-full object-cover"
                                />
                              </div>
                              <button
                                type="button"
                                disabled={!row.item.isAvailable}
                                onClick={() => cart.addItem(row.item)}
                                className={`mt-2 rounded-lg bg-[var(--bistro-brand)] py-1.5 text-xs font-bold text-white disabled:opacity-40 ${
                                  locale === 'ar' ? '' : 'uppercase tracking-wide'
                                }`}
                              >
                                {t('customer.bistroAdd')}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
            </main>
          </>
        ) : null}

        {tab === 'orders' ? (
          <main className="space-y-4 px-4 pt-4">
            <div>
              <h2 className="bistro-serif text-2xl font-semibold text-stone-900">{t('customer.myOrders')}</h2>
              <p className="text-xs text-stone-500">{realtimeLabel}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-stone-500">
                {ordersLoading ? t('common.loading') : t('customer.ordersCount', { count: orders.length })}
              </p>
              <button
                type="button"
                onClick={() => void refreshOrders()}
                className="text-sm font-semibold text-[var(--bistro-brand)]"
              >
                {t('common.refresh')}
              </button>
            </div>
            {orders.length === 0 ? (
              <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
                <p className="text-stone-500">{t('customer.noOrders')}</p>
                <button
                  type="button"
                  onClick={() => setTab('menu')}
                  className="mt-4 rounded-full bg-[var(--bistro-brand)] px-6 py-2 text-sm font-semibold text-white"
                >
                  {t('customer.browseMenu')}
                </button>
              </div>
            ) : (
              orders.map((order) => (
                <article key={order.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-stone-900">{orderStatusLabel(t, order.status)}</p>
                    <p className="text-sm font-semibold text-[var(--bistro-brand)]">{formatMoneyDetailed(order.total)}</p>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-stone-600">
                    {order.items.map((line) => (
                      <li key={`${order.id}-${line.menuItemId}`}>
                        {line.quantity}× {line.name}
                      </li>
                    ))}
                  </ul>
                </article>
              ))
            )}
          </main>
        ) : null}
      </div>

      {cart.itemCount > 0 && !cartOpen ? (
        <div className="fixed inset-x-0 bottom-[4.5rem] z-20 mx-auto max-w-lg px-4">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between rounded-xl bg-[var(--bistro-brand)] px-5 py-3 font-bold text-white shadow-lg"
          >
            <span>{t('customer.viewCart', { count: cart.itemCount })}</span>
            <span>{formatMoneyDetailed(cart.subtotal)}</span>
          </button>
        </div>
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-stone-200 bg-white px-6 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
        aria-label={t('common.mainNavigation')}
      >
        <ul className="flex justify-between">
          <BistroNavItem
            label={t('customer.navMenu')}
            active={tab === 'menu'}
            onClick={() => setTab('menu')}
            icon="🍴"
          />
          <BistroNavItem
            label={t('customer.bistroNavSearch')}
            active={tab === 'search'}
            onClick={() => setTab('search')}
            icon={<IconSearch className="h-5 w-5" />}
          />
          <BistroNavItem
            label={t('customer.navOrders')}
            active={tab === 'orders'}
            onClick={() => setTab('orders')}
            icon="🧾"
          />
        </ul>
      </nav>

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        submitting={submitting}
        submitError={submitError}
        onPlaceOrder={() => void handlePlaceOrder()}
      />
    </BistroFrame>
  );
}

function BistroFrame({ children, dir }: { children: ReactNode; dir: 'ltr' | 'rtl' }) {
  return (
    <div
      dir={dir}
      className="customer-app-bistro mx-auto min-h-screen max-w-lg bg-white text-stone-900 shadow-xl sm:my-4 sm:min-h-[calc(100vh-2rem)] sm:rounded-[2rem] sm:border sm:border-stone-200/60"
    >
      {children}
    </div>
  );
}

function CategoryTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 border-b-2 pb-2 text-sm font-medium transition-colors ${
        active
          ? 'border-[var(--bistro-brand)] text-[var(--bistro-brand)]'
          : 'border-transparent text-stone-500'
      }`}
    >
      {label}
    </button>
  );
}

function BistroNavItem({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex flex-col items-center gap-0.5 px-2 py-1">
        <span className={active ? 'text-[var(--bistro-brand)]' : 'text-stone-400'}>{icon}</span>
        <span
          className={`text-[11px] font-medium ${active ? 'text-[var(--bistro-brand)]' : 'text-stone-500'}`}
        >
          {label}
        </span>
      </button>
    </li>
  );
}
