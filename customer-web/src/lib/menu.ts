import { apiRequest } from './api';

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
  imageUrl: string | null;
  sortOrder: number;
};

export type MenuCategory = {
  name: string;
  sortOrder: number;
  items: MenuItem[];
};

export type PublicTable = {
  restaurantName: string;
  tableNumber: string;
  requireStaffOpen: boolean;
  sessionOpen: boolean;
  menu: { categories: MenuCategory[] };
};

export async function fetchPublicTable(qrToken: string) {
  const result = await apiRequest<{ table: PublicTable }>(`/api/public/tables/${encodeURIComponent(qrToken)}`);
  return result.table;
}
