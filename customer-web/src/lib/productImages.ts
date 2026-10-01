import type { MenuItem } from './menu';

/** Verified Unsplash CDN URLs (404-prone IDs removed). */
function unsplash(photoId: string, width = 600) {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=80`;
}

export const FOOD_IMAGE_DEFAULT = unsplash('1546069901-ba9599a7e63c');

export const STOCK = {
  platter: unsplash('1504674900247-0877df9cc836'),
  salad: unsplash('1512621776951-a57141f2eefd'),
  bowl: FOOD_IMAGE_DEFAULT,
  grilled: unsplash('1555939594-58d7cb561ad1'),
  burger: unsplash('1568901346375-23c9450c58cd'),
  fried: unsplash('1606755962773-d324e0a13086'),
  asian: unsplash('1529042410759-befb1204b468'),
  rice: unsplash('1563379091339-03b21ab4a4f8'),
  soup: unsplash('1547592166-23ac45744acd'),
  drink: unsplash('1495474472287-4d71bcdd2085'),
  dessert: unsplash('1488477181946-6428a0291777'),
  fries: unsplash('1546173159-315724a31696'),
  pizza: unsplash('1565299624946-b28f40a0ae38'),
  wrap: unsplash('1626700051175-6818013e1d4f'),
};

const KEYWORD_IMAGES: { match: RegExp; url: string }[] = [
  { match: /spring roll|starter|snack|roll/i, url: STOCK.asian },
  { match: /tikka|tandoor|grilled/i, url: STOCK.grilled },
  { match: /butter chicken|chicken(?! biryani)/i, url: STOCK.fried },
  { match: /soup|tomato/i, url: STOCK.soup },
  { match: /paneer|dal|masala/i, url: STOCK.bowl },
  { match: /veg/i, url: STOCK.salad },
  { match: /naan|bread|roti/i, url: STOCK.platter },
  { match: /biryani|rice/i, url: STOCK.rice },
  { match: /chai|tea|lassi|soda|drink|beverage|lime|mango/i, url: STOCK.drink },
  { match: /dessert|jamun|sweet|gulab/i, url: STOCK.dessert },
  { match: /burger/i, url: STOCK.burger },
  { match: /bucket|combo|fries|side/i, url: STOCK.fries },
];

const CATEGORY_IMAGES: Record<string, string> = {
  all: STOCK.grilled,
  starters: STOCK.asian,
  'main course': STOCK.fried,
  'breads and rice': STOCK.rice,
  beverages: STOCK.drink,
  desserts: STOCK.dessert,
  buckets: STOCK.grilled,
  burgers: STOCK.burger,
  snacks: STOCK.asian,
  sides: STOCK.fries,
  drinks: STOCK.drink,
};

export const HERO_IMAGES = [
  unsplash('1555939594-58d7cb561ad1', 900),
  unsplash('1606755962773-d324e0a13086', 900),
];

export function categoryImage(categoryName: string): string {
  const key = categoryName.toLowerCase();
  return CATEGORY_IMAGES[key] ?? CATEGORY_IMAGES.all;
}

export function menuItemImage(item: MenuItem, categoryName: string, resolvedApiUrl: string | null): string {
  if (resolvedApiUrl) {
    return resolvedApiUrl;
  }
  const haystack = `${item.name} ${item.description ?? ''} ${categoryName}`;
  for (const row of KEYWORD_IMAGES) {
    if (row.match.test(haystack)) {
      return row.url;
    }
  }
  return categoryImage(categoryName);
}

/** Stable pseudo-rating for display only */
export function displayRating(itemId: string): { score: string; label: string } {
  let hash = 0;
  for (let i = 0; i < itemId.length; i++) {
    hash = (hash + itemId.charCodeAt(i) * (i + 1)) % 97;
  }
  const score = 4.2 + (hash % 8) / 10;
  const reviews = 1.2 + (hash % 40) / 10;
  return { score: score.toFixed(1), label: `${reviews.toFixed(1)}K+` };
}
