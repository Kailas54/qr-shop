import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { LanguageToggle, useI18n } from '../../../../shared/i18n/index.tsx';
import { HERO_IMAGES, STOCK, categoryImage } from '../../lib/productImages';
import { FoodImage } from './FoodImage';
import {
  IconArrowRight,
  IconBag,
  IconBell,
  IconGrid,
  IconHome,
  IconMenu,
  IconSearch,
  IconTag,
  IconUser,
} from './icons';

export type NavTab = 'home' | 'menu' | 'orders' | 'offers' | 'profile';

type HeaderProps = {
  restaurantName: string;
  tableNumber: string;
  cartCount: number;
  onOpenCart: () => void;
  onOpenMenu?: () => void;
};

export function CustomerHeader({ restaurantName, tableNumber, cartCount, onOpenCart, onOpenMenu }: HeaderProps) {
  const { t } = useI18n();
  return (
    <header className="px-4 pt-3 pb-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-stone-700 shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
          aria-label="Menu"
        >
          <IconMenu className="h-5 w-5" />
        </button>
        <LanguageToggle className="hidden min-[380px]:inline-flex" />
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-stone-700 shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
            aria-label="Notifications"
          >
            <IconBell className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-white">
              3
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenCart}
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-stone-700 shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
            aria-label="Cart"
          >
            <IconBag className="h-5 w-5" />
            {cartCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-white">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>
      <div className="mt-3 flex justify-center min-[380px]:hidden">
        <LanguageToggle />
      </div>
      <div className="mt-4 text-center">
        <p className="text-sm text-stone-500">{t('customer.hello')}</p>
        <p className="mt-1 text-3xl font-black tracking-tight text-[var(--brand)]">{brandShortName(restaurantName)}</p>
        <p className="text-xs font-medium text-stone-500">
          {t('common.table')} {tableNumber} · {t('customer.tagline')}
        </p>
      </div>
    </header>
  );
}

function brandShortName(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length <= 2) {
    return name.toUpperCase();
  }
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

type SearchProps = {
  value: string;
  onChange: (value: string) => void;
  vegOnly: boolean;
  onToggleVeg: () => void;
};

export function SearchBar({ value, onChange, vegOnly, onToggleVeg }: SearchProps) {
  const { t } = useI18n();
  return (
    <div className="flex gap-2 px-4 py-2">
      <label className="relative flex flex-1 items-center">
        <IconSearch className="pointer-events-none absolute start-4 h-5 w-5 text-stone-400" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('customer.searchPlaceholder')}
          className="w-full rounded-2xl border-0 bg-white py-3.5 ps-12 pe-4 text-sm text-stone-800 shadow-[0_4px_20px_rgba(0,0,0,0.05)] outline-none placeholder:text-stone-400"
        />
      </label>
      <button
        type="button"
        onClick={onToggleVeg}
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] ${
          vegOnly ? 'bg-[var(--brand)] text-white' : 'bg-white text-stone-600'
        }`}
        aria-label={t('customer.vegFilter')}
        title={t('customer.vegFilter')}
      >
        <span className="text-lg">🟢</span>
      </button>
    </div>
  );
}

export function HeroCarousel() {
  const { t } = useI18n();
  const [slide, setSlide] = useState(0);

  const slides = useMemo(
    () => [
      {
        tag: t('customer.heroLimited'),
        title: t('customer.heroCrispy'),
        subtitle: t('customer.heroFresh'),
        image: HERO_IMAGES[0],
      },
      {
        tag: t('customer.heroTableTag'),
        title: t('customer.heroTableTitle'),
        subtitle: t('customer.heroTableSub'),
        image: HERO_IMAGES[1],
      },
    ],
    [t],
  );

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  const current = slides[slide];

  return (
    <div className="px-4 py-2">
      <div className="relative overflow-hidden rounded-3xl bg-stone-900 text-white shadow-lg">
        <FoodImage src={current.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="relative bg-gradient-to-r from-black/75 via-black/50 to-transparent p-5 sm:p-6 rtl:bg-gradient-to-l">
          <span className="inline-block rounded-md bg-[var(--brand)] px-2 py-0.5 text-[10px] font-bold tracking-wider">
            {current.tag}
          </span>
          <h2 className="mt-2 max-w-[14rem] text-xl font-black leading-tight sm:max-w-none sm:text-2xl">{current.title}</h2>
          <p className="mt-2 max-w-xs text-xs text-white/85 sm:text-sm">{current.subtitle}</p>
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold"
          >
            {t('customer.orderNow')}
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
              <IconArrowRight className="h-4 w-4" />
            </span>
          </button>
        </div>
        <div className="relative flex justify-center gap-1.5 pb-3">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => setSlide(i)}
              className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-5 bg-[var(--brand)]' : 'w-1.5 bg-white/50'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type CategoryStripProps = {
  categories: { name: string }[];
  selected: string | null;
  onSelect: (name: string | null) => void;
};

export function CategoryStrip({ categories, selected, onSelect }: CategoryStripProps) {
  const { locale } = useI18n();
  const allLabel = locale === 'ar' ? 'الكل' : 'All';
  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <CategoryChip label={allLabel} image={categoryImage('all')} active={selected === null} onClick={() => onSelect(null)} />
      {categories.map((cat) => (
        <CategoryChip
          key={cat.name}
          label={cat.name}
          image={categoryImage(cat.name)}
          active={selected === cat.name}
          onClick={() => onSelect(cat.name)}
        />
      ))}
    </div>
  );
}

function CategoryChip({
  label,
  image,
  active,
  onClick,
}: {
  label: string;
  image: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5">
      <span
        className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 bg-white p-0.5 shadow-sm ${
          active ? 'border-[var(--brand)]' : 'border-transparent'
        }`}
      >
        <FoodImage src={image} alt="" className="h-full w-full rounded-full object-cover" />
      </span>
      <span className={`text-center text-[11px] font-semibold leading-tight ${active ? 'text-[var(--brand)]' : 'text-stone-600'}`}>
        {label.length > 10 ? label.split(' ')[0] : label}
      </span>
    </button>
  );
}

export function PromoBanner() {
  const { t } = useI18n();
  return (
    <div className="mx-4 my-4 overflow-hidden rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-3">
        <FoodImage src={STOCK.fries} alt="" className="h-16 w-16 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-wide text-[var(--brand)]">{t('customer.exclusiveOffer')}</p>
          <p className="text-sm font-bold text-stone-900">{t('customer.offerText')}</p>
          <button type="button" className="mt-1 text-xs font-semibold text-[var(--brand)]">{t('customer.orderNow')}</button>
        </div>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-center text-[10px] font-black leading-tight text-white">
          30%
          <br />
          OFF
        </div>
      </div>
    </div>
  );
}

type BottomNavProps = {
  tab: NavTab;
  onChange: (tab: NavTab) => void;
};

export function BottomNav({ tab, onChange }: BottomNavProps) {
  const { t } = useI18n();
  const items: { id: NavTab; label: string; icon: typeof IconHome; center?: boolean }[] = [
    { id: 'home', label: t('customer.navHome'), icon: IconHome },
    { id: 'menu', label: t('customer.navMenu'), icon: IconGrid },
    { id: 'orders', label: t('customer.navOrders'), icon: IconBag, center: true },
    { id: 'offers', label: t('customer.navOffers'), icon: IconTag },
    { id: 'profile', label: t('customer.navProfile'), icon: IconUser },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-stone-200/80 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md"
      aria-label="Main"
    >
      <ul className="flex items-end justify-between">
        {items.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          if (item.center) {
            return (
              <li key={item.id} className="flex-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => onChange(item.id)}
                  className="-mt-6 flex flex-col items-center gap-1"
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg ${
                      active ? 'bg-[var(--brand)] text-white' : 'bg-[var(--brand)] text-white'
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className={`text-[10px] font-semibold ${active ? 'text-[var(--brand)]' : 'text-stone-500'}`}>
                    {item.label}
                  </span>
                </button>
              </li>
            );
          }
          return (
            <li key={item.id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(item.id)}
                className="flex w-full flex-col items-center gap-0.5 py-1"
              >
                <Icon className={`h-6 w-6 ${active ? 'text-[var(--brand)]' : 'text-stone-400'}`} />
                <span className={`text-[10px] font-semibold ${active ? 'text-[var(--brand)]' : 'text-stone-500'}`}>
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function CustomerFrame({ children }: { children: ReactNode }) {
  return (
    <div className="customer-app mx-auto min-h-screen max-w-lg bg-[var(--bg-cream)] text-stone-900 shadow-xl sm:my-4 sm:min-h-[calc(100vh-2rem)] sm:rounded-[2rem] sm:border sm:border-stone-200/60">
      {children}
    </div>
  );
}
