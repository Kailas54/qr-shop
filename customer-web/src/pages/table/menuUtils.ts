import type { MenuCategory, MenuItem } from '../../lib/menu';

export type MenuRow = { item: MenuItem; categoryName: string };

export function flattenMenu(categories: MenuCategory[]): MenuRow[] {
  return categories.flatMap((cat) => cat.items.map((item) => ({ item, categoryName: cat.name })));
}

export function formatMoney(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

export function formatMoneyDetailed(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`;
}
