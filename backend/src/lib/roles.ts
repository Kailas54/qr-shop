import type { AdminRole } from '@prisma/client';

export const ROLES_MANAGE_MENU_AND_TABLES: AdminRole[] = ['owner', 'manager'];

export const ROLES_ALL_STAFF: AdminRole[] = ['owner', 'manager', 'waiter', 'kitchen'];

/** Open/close tables and manage table sessions. */
export const ROLES_MANAGE_TABLE_SESSIONS: AdminRole[] = ['owner', 'manager', 'waiter'];

export function roleCanManageMenuAndTables(role: AdminRole): boolean {
  return ROLES_MANAGE_MENU_AND_TABLES.includes(role);
}

export function assertRoleAllowed(role: AdminRole, allowed: AdminRole[]): void {
  if (!allowed.includes(role)) {
    throw new Error('FORBIDDEN_ROLE');
  }
}
