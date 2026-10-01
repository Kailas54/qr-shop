import { HttpError } from '../lib/errors';
import { prisma } from '../lib/db';
import { findActiveSessionForTable } from './sessionService';

export async function getPublicTableByQrToken(qrToken: string) {
  const table = await prisma.table.findFirst({
    where: { qrToken, isActive: true },
    select: {
      id: true,
      tableNumber: true,
      restaurant: {
        select: {
          name: true,
          requireStaffOpen: true,
          categories: {
            orderBy: { sortOrder: 'asc' },
            select: {
              name: true,
              sortOrder: true,
              items: {
                orderBy: { sortOrder: 'asc' },
                select: {
                  id: true,
                  name: true,
                  description: true,
                  price: true,
                  isVeg: true,
                  isAvailable: true,
                  imageUrl: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!table) {
    throw new HttpError(404, 'NOT_FOUND', 'Table not found');
  }

  const activeSession = await findActiveSessionForTable(table.id);

  const categories = table.restaurant.categories
    .map((category) => ({
      name: category.name,
      sortOrder: category.sortOrder,
      items: category.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        isVeg: item.isVeg,
        isAvailable: item.isAvailable,
        imageUrl: item.imageUrl,
        sortOrder: item.sortOrder,
      })),
    }))
    .filter((category) => category.items.length > 0);

  return {
    restaurantName: table.restaurant.name,
    tableNumber: table.tableNumber,
    requireStaffOpen: table.restaurant.requireStaffOpen,
    sessionOpen: activeSession !== null,
    menu: { categories },
  };
}
