export function canManageMenuAndTables(role: string | undefined) {
  return role === 'owner' || role === 'manager';
}
