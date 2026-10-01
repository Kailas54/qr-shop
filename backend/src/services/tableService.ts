import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/errors';
import { prisma } from '../lib/db';
import { buildTableCustomerUrl } from './qrService';

function mapTable(row: {
  id: string;
  tableNumber: string;
  qrToken: string;
  isActive: boolean;
  restaurantId: string;
}) {
  return {
    id: row.id,
    tableNumber: row.tableNumber,
    isActive: row.isActive,
    customerUrl: buildTableCustomerUrl(row.qrToken),
  };
}

export async function listTables(restaurantId: string) {
  const rows = await prisma.table.findMany({
    where: { restaurantId },
    orderBy: { tableNumber: 'asc' },
    select: { id: true, tableNumber: true, qrToken: true, isActive: true, restaurantId: true },
  });
  return rows.map(mapTable);
}

export async function createTable(restaurantId: string, tableNumber: string, isActive: boolean) {
  try {
    const row = await prisma.table.create({
      data: {
        restaurantId,
        tableNumber,
        isActive,
        qrToken: randomBytes(32).toString('base64url'),
      },
      select: { id: true, tableNumber: true, qrToken: true, isActive: true, restaurantId: true },
    });
    return mapTable(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'TABLE_EXISTS', 'A table with this number already exists');
    }
    throw error;
  }
}

export async function updateTable(restaurantId: string, tableId: string, data: { tableNumber?: string; isActive?: boolean }) {
  const existing = await prisma.table.findFirst({
    where: { id: tableId, restaurantId },
    select: { id: true },
  });
  if (!existing) {
    throw new HttpError(404, 'NOT_FOUND', 'Table not found');
  }

  try {
    const row = await prisma.table.update({
      where: { id: tableId },
      data,
      select: { id: true, tableNumber: true, qrToken: true, isActive: true, restaurantId: true },
    });
    return mapTable(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'TABLE_EXISTS', 'A table with this number already exists');
    }
    throw error;
  }
}

export async function getTableForRestaurant(restaurantId: string, tableId: string) {
  const row = await prisma.table.findFirst({
    where: { id: tableId, restaurantId },
    select: { id: true, tableNumber: true, qrToken: true, isActive: true, restaurantId: true },
  });
  if (!row) {
    throw new HttpError(404, 'NOT_FOUND', 'Table not found');
  }
  return row;
}

export async function listTablesWithTokens(restaurantId: string) {
  return prisma.table.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { tableNumber: 'asc' },
    select: { id: true, tableNumber: true, qrToken: true },
  });
}
