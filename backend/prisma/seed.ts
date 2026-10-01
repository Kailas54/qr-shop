import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const rootEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

const prisma = new PrismaClient();

const RESTAURANT_NAME = 'Demo Restaurant';
const OWNER_EMAIL = 'owner@demo.local';
const OWNER_NAME = 'Demo Owner';
const OWNER_PASSWORD = 'Owner@12345';

type SeedItem = {
  name: string;
  description: string;
  price: number;
  isVeg: boolean;
  isAvailable?: boolean;
  sortOrder: number;
};

type SeedCategory = {
  name: string;
  sortOrder: number;
  items: SeedItem[];
};

const menu: SeedCategory[] = [
  {
    name: 'Starters',
    sortOrder: 0,
    items: [
      { name: 'Veg Spring Rolls', description: 'Crisp rolls with cabbage and carrot', price: 18000, isVeg: true, sortOrder: 0 },
      { name: 'Chicken Tikka', description: 'Yogurt-marinated chicken, tandoor finished', price: 32000, isVeg: false, sortOrder: 1 },
      { name: 'Tomato Soup', description: 'Lightly spiced tomato broth', price: 14000, isVeg: true, sortOrder: 2 },
    ],
  },
  {
    name: 'Main Course',
    sortOrder: 1,
    items: [
      { name: 'Paneer Butter Masala', description: 'Paneer in a tomato and cashew gravy', price: 34000, isVeg: true, sortOrder: 0 },
      { name: 'Butter Chicken', description: 'Tandoori chicken in a mild buttery gravy', price: 38000, isVeg: false, sortOrder: 1 },
      { name: 'Dal Tadka', description: 'Yellow lentils tempered with garlic', price: 22000, isVeg: true, sortOrder: 2 },
    ],
  },
  {
    name: 'Breads and Rice',
    sortOrder: 2,
    items: [
      { name: 'Butter Naan', description: 'Tandoor bread brushed with butter', price: 6000, isVeg: true, sortOrder: 0 },
      { name: 'Steamed Rice', description: 'Plain basmati rice', price: 12000, isVeg: true, sortOrder: 1 },
      { name: 'Chicken Biryani', description: 'Spiced rice with chicken', price: 36000, isVeg: false, sortOrder: 2 },
    ],
  },
  {
    name: 'Beverages',
    sortOrder: 3,
    items: [
      { name: 'Masala Chai', description: 'Hot spiced tea', price: 4000, isVeg: true, sortOrder: 0 },
      { name: 'Fresh Lime Soda', description: 'Sweet, salted, or mixed', price: 8000, isVeg: true, sortOrder: 1 },
      {
        name: 'Seasonal Mango Lassi',
        description: 'Unavailable outside mango season',
        price: 12000,
        isVeg: true,
        isAvailable: false,
        sortOrder: 2,
      },
    ],
  },
  {
    name: 'Desserts',
    sortOrder: 4,
    items: [
      { name: 'Gulab Jamun', description: 'Warm milk dumplings in sugar syrup', price: 12000, isVeg: true, sortOrder: 0 },
    ],
  },
];

async function main(): Promise<void> {
  const existing = await prisma.restaurant.findFirst({ where: { name: RESTAURANT_NAME } });
  if (existing) {
    console.log(`Seed skipped: "${RESTAURANT_NAME}" already exists (${existing.id}).`);
    return;
  }

  const cost = Number(process.env.BCRYPT_COST ?? 12);
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, Number.isInteger(cost) && cost >= 12 ? cost : 12);

  const restaurant = await prisma.$transaction(
    async (tx) => {
    const created = await tx.restaurant.create({
      data: {
        name: RESTAURANT_NAME,
        requireStaffOpen: true,
      },
    });

    await tx.admin.create({
      data: {
        restaurantId: created.id,
        name: OWNER_NAME,
        email: OWNER_EMAIL,
        passwordHash,
        role: 'owner',
      },
    });

    for (const category of menu) {
      const createdCategory = await tx.category.create({
        data: {
          restaurantId: created.id,
          name: category.name,
          sortOrder: category.sortOrder,
        },
      });

      for (const item of category.items) {
        await tx.menuItem.create({
          data: {
            restaurantId: created.id,
            categoryId: createdCategory.id,
            name: item.name,
            description: item.description,
            price: item.price,
            isVeg: item.isVeg,
            isAvailable: item.isAvailable ?? true,
            sortOrder: item.sortOrder,
          },
        });
      }
    }

    for (let tableNumber = 1; tableNumber <= 10; tableNumber += 1) {
      await tx.table.create({
        data: {
          restaurantId: created.id,
          tableNumber: String(tableNumber),
          qrToken: randomBytes(32).toString('base64url'),
          isActive: true,
        },
      });
    }

    return created;
    },
    { maxWait: 15_000, timeout: 120_000 },
  );

  console.log(`Seeded ${RESTAURANT_NAME} (${restaurant.id}).`);
  console.log(`Owner email: ${OWNER_EMAIL}`);
  console.log('Owner password is documented in the README (local seed only).');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
