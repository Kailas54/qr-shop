import { randomInt } from 'crypto';
import bcrypt from 'bcrypt';
import { env } from '../config/env';

export function generateTablePin(): string {
  return randomInt(0, 10_000).toString().padStart(4, '0');
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, env.BCRYPT_COST);
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  return bcrypt.compare(pin, pinHash);
}
