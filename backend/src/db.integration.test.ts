import { describe, expect, it } from 'vitest';
import { prisma } from './lib/db';

describe('seeded database', () => {
  it('contains one demo restaurant, an owner, menu rows, and 10 tables', async () => {
    const restaurant = await prisma.restaurant.findFirst({
      where: { name: 'Demo Restaurant' },
      include: {
        admins: true,
        categories: { orderBy: { sortOrder: 'asc' } },
        menuItems: true,
        tables: { orderBy: { tableNumber: 'asc' } },
      },
    });

    expect(restaurant).not.toBeNull();
    expect(restaurant?.requireStaffOpen).toBe(true);
    const owner = restaurant?.admins.find((admin) => admin.email === 'owner@demo.local');
    expect(owner).toEqual(
      expect.objectContaining({
        email: 'owner@demo.local',
        role: 'owner',
        name: 'Demo Owner',
      }),
    );
    expect(owner?.passwordHash.startsWith('$2')).toBe(true);
    expect(owner?.passwordHash).not.toContain('Owner@12345');

    const categoryNames = restaurant?.categories.map((category) => category.name) ?? [];
    expect(categoryNames).toContain('Starters');
    expect(categoryNames).toContain('Desserts');
    expect(categoryNames.length).toBeGreaterThanOrEqual(5);

    const paneer = restaurant?.menuItems.find((item) => item.name === 'Paneer Butter Masala');
    expect(paneer?.price).toBe(34000);
    expect(Number.isInteger(paneer?.price)).toBe(true);

    const lassi = restaurant?.menuItems.find((item) => item.name === 'Seasonal Mango Lassi');
    expect(lassi?.isAvailable).toBe(false);

    expect(restaurant?.tables).toHaveLength(10);
    expect(restaurant?.tables.map((table) => table.tableNumber).sort((a, b) => Number(a) - Number(b))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ]);
    const tokens = restaurant?.tables.map((table) => table.qrToken) ?? [];
    expect(new Set(tokens).size).toBe(10);
    for (const token of tokens) {
      expect(token.length).toBeGreaterThanOrEqual(42);
    }
  });
});
