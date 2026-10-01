import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/errors';
import { prisma } from '../lib/db';

export async function listCategories(restaurantId: string) {
  return prisma.category.findMany({
    where: { restaurantId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, sortOrder: true },
  });
}

export async function createCategory(restaurantId: string, name: string, sortOrder: number) {
  return prisma.category.create({
    data: { restaurantId, name, sortOrder },
    select: { id: true, name: true, sortOrder: true },
  });
}

export async function updateCategory(restaurantId: string, categoryId: string, data: { name?: string; sortOrder?: number }) {
  const existing = await prisma.category.findFirst({ where: { id: categoryId, restaurantId } });
  if (!existing) {
    throw new HttpError(404, 'NOT_FOUND', 'Category not found');
  }
  return prisma.category.update({
    where: { id: categoryId },
    data,
    select: { id: true, name: true, sortOrder: true },
  });
}

export async function deleteCategory(restaurantId: string, categoryId: string) {
  const existing = await prisma.category.findFirst({
    where: { id: categoryId, restaurantId },
    include: { items: { select: { id: true }, take: 1 } },
  });
  if (!existing) {
    throw new HttpError(404, 'NOT_FOUND', 'Category not found');
  }
  if (existing.items.length > 0) {
    throw new HttpError(409, 'CATEGORY_NOT_EMPTY', 'Remove or move menu items before deleting this category');
  }
  await prisma.category.delete({ where: { id: categoryId } });
}

export async function listMenuItems(restaurantId: string) {
  return prisma.menuItem.findMany({
    where: { restaurantId },
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    select: {
      id: true,
      categoryId: true,
      name: true,
      description: true,
      price: true,
      imageUrl: true,
      isAvailable: true,
      isVeg: true,
      sortOrder: true,
      category: { select: { id: true, name: true } },
    },
  });
}

export async function createMenuItem(
  restaurantId: string,
  input: {
    categoryId: string;
    name: string;
    description: string;
    price: number;
    isAvailable: boolean;
    isVeg: boolean;
    sortOrder: number;
    imageUrl?: string | null;
  },
) {
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, restaurantId },
    select: { id: true },
  });
  if (!category) {
    throw new HttpError(400, 'INVALID_CATEGORY', 'Category does not belong to this restaurant');
  }

  return prisma.menuItem.create({
    data: {
      restaurantId,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description,
      price: input.price,
      isAvailable: input.isAvailable,
      isVeg: input.isVeg,
      sortOrder: input.sortOrder,
      imageUrl: input.imageUrl ?? null,
    },
    select: {
      id: true,
      categoryId: true,
      name: true,
      description: true,
      price: true,
      imageUrl: true,
      isAvailable: true,
      isVeg: true,
      sortOrder: true,
    },
  });
}

export async function updateMenuItem(
  restaurantId: string,
  itemId: string,
  input: {
    categoryId?: string;
    name?: string;
    description?: string;
    price?: number;
    isAvailable?: boolean;
    isVeg?: boolean;
    sortOrder?: number;
    imageUrl?: string | null;
  },
) {
  const existing = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId } });
  if (!existing) {
    throw new HttpError(404, 'NOT_FOUND', 'Menu item not found');
  }

  if (input.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, restaurantId },
      select: { id: true },
    });
    if (!category) {
      throw new HttpError(400, 'INVALID_CATEGORY', 'Category does not belong to this restaurant');
    }
  }

  try {
    return await prisma.menuItem.update({
      where: { id: itemId },
      data: input,
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        isAvailable: true,
        isVeg: true,
        sortOrder: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw error;
    }
    throw error;
  }
}

export async function deleteMenuItem(restaurantId: string, itemId: string) {
  const existing = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId } });
  if (!existing) {
    throw new HttpError(404, 'NOT_FOUND', 'Menu item not found');
  }
  await prisma.menuItem.delete({ where: { id: itemId } });
}

export async function setMenuItemAvailability(restaurantId: string, itemId: string, isAvailable: boolean) {
  return updateMenuItem(restaurantId, itemId, { isAvailable });
}
