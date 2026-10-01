import type { AdminRole } from '@prisma/client';

export {};

declare global {
  namespace Express {
    interface Request {
      id?: string;
      idempotencyKey?: string;
      skipOrderRateLimit?: boolean;
      admin?: {
        id: string;
        restaurantId: string;
        role: AdminRole;
        email: string;
        name: string;
      };
      guestSession?: {
        sessionId: string;
        tableId: string;
        restaurantId: string;
        tableNumber: string;
        expiresAt: Date;
      };
    }
  }
}