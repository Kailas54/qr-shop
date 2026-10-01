import { useState } from 'react';
import { useI18n } from '../../../../shared/i18n/index.tsx';
import type { MenuItem } from '../../lib/menu';
import { categoryImage, displayRating, menuItemImage } from '../../lib/productImages';
import { FoodImage } from './FoodImage';
import { IconHeart, IconPlus, IconStar } from './icons';

type Props = {
  item: MenuItem;
  categoryName: string;
  imageUrl: string | null;
  index: number;
  onAdd: () => void;
  layout?: 'carousel' | 'grid';
};

function formatMoney(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

function badgeKey(index: number): string | null {
  if (index === 0) return 'customer.badgeBestseller';
  if (index === 1) return 'customer.badgePopular';
  if (index === 2) return 'customer.badgeSave';
  return null;
}

export function ProductCard({ item, categoryName, imageUrl, index, onAdd, layout = 'carousel' }: Props) {
  const { t } = useI18n();
  const [liked, setLiked] = useState(false);
  const badgeKeyName = badgeKey(index);
  const badge = badgeKeyName ? t(badgeKeyName) : null;
  const rating = displayRating(item.id);
  const img = menuItemImage(item, categoryName, imageUrl);
  const imgFallback = categoryImage(categoryName);

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] ${
        layout === 'carousel' ? 'w-[min(100%,280px)] shrink-0' : 'w-full'
      }`}
    >
      <div className="relative aspect-[4/3] bg-[#f5f0e8]">
        <FoodImage src={img} fallback={imgFallback} alt={item.name} className="h-full w-full object-cover" />
        {badge ? (
          <span
            className={`absolute start-3 top-3 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide text-white ${
              index === 1 ? 'bg-[#f59e0b]' : 'bg-[var(--brand)]'
            }`}
          >
            {badge}
          </span>
        ) : null}
        <button
          type="button"
          aria-label={liked ? 'Remove from favorites' : 'Add to favorites'}
          onClick={() => setLiked((v) => !v)}
          className="absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-stone-500 shadow-sm"
        >
          <IconHeart className="h-4 w-4" filled={liked} />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-bold leading-snug text-stone-900">{item.name}</h3>
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-stone-500">{item.description}</p>
        ) : null}
        <div className="mt-2 flex items-center gap-1 text-xs text-stone-600">
          <IconStar className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-semibold">{rating.score}</span>
          <span className="text-stone-400">({rating.label})</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-lg font-bold text-stone-900">{formatMoney(item.price)}</p>
          <button
            type="button"
            disabled={!item.isAvailable}
            onClick={onAdd}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-md disabled:opacity-40"
            aria-label={`Add ${item.name}`}
          >
            <IconPlus className="h-5 w-5" />
          </button>
        </div>
      </div>
    </article>
  );
}
