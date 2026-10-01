import { getAuthBridge } from '../auth/sessionBridge';
import { apiRequestAuthed, getApiUrl } from './api';

export type MenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isVeg: boolean;
  sortOrder: number;
  category: { id: string; name: string };
};

export async function fetchCategories() {
  const result = await apiRequestAuthed<{ categories: MenuCategory[] }>('/api/admin/menu/categories');
  return result.categories;
}

export async function createCategory(name: string, sortOrder: number) {
  const result = await apiRequestAuthed<{ category: MenuCategory }>('/api/admin/menu/categories', {
    method: 'POST',
    body: JSON.stringify({ name, sortOrder }),
  });
  return result.category;
}

export async function updateCategory(id: string, data: { name?: string; sortOrder?: number }) {
  const result = await apiRequestAuthed<{ category: MenuCategory }>(`/api/admin/menu/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return result.category;
}

export async function deleteCategory(id: string) {
  await apiRequestAuthed<void>(`/api/admin/menu/categories/${id}`, { method: 'DELETE' });
}

export async function fetchMenuItems() {
  const result = await apiRequestAuthed<{ items: MenuItem[] }>('/api/admin/menu/items');
  return result.items;
}

export async function createMenuItem(input: {
  categoryId: string;
  name: string;
  description: string;
  price: number;
  isAvailable: boolean;
  isVeg: boolean;
  sortOrder: number;
  imageUrl?: string | null;
}) {
  const result = await apiRequestAuthed<{ item: MenuItem }>('/api/admin/menu/items', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.item;
}

export async function updateMenuItem(
  id: string,
  input: Partial<{
    categoryId: string;
    name: string;
    description: string;
    price: number;
    isAvailable: boolean;
    isVeg: boolean;
    sortOrder: number;
    imageUrl: string | null;
  }>,
) {
  const result = await apiRequestAuthed<{ item: MenuItem }>(`/api/admin/menu/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return result.item;
}

export async function deleteMenuItem(id: string) {
  await apiRequestAuthed<void>(`/api/admin/menu/items/${id}`, { method: 'DELETE' });
}

export async function setMenuItemAvailability(id: string, isAvailable: boolean) {
  const result = await apiRequestAuthed<{ item: MenuItem }>(`/api/admin/menu/items/${id}/availability`, {
    method: 'PATCH',
    body: JSON.stringify({ isAvailable }),
  });
  return result.item;
}

export async function uploadMenuItemImage(itemId: string, file: File) {
  const token = getAuthBridge()?.getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  const form = new FormData();
  form.append('image', file);
  const response = await fetch(`${getApiUrl()}/api/admin/menu/items/${itemId}/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as { item?: MenuItem; error?: { message: string } }) : {};
  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Image upload failed');
  }
  if (!body.item) {
    throw new Error('Image upload failed');
  }
  return body.item;
}
