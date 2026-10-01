import { getAuthBridge } from '../auth/sessionBridge';
import { apiRequestAuthed, getApiUrl } from './api';

export type AdminTable = {
  id: string;
  tableNumber: string;
  isActive: boolean;
  customerUrl: string;
};

export type OpenSession = {
  id: string;
  status: string;
  table: { id: string; tableNumber: string };
};

export async function fetchTables() {
  const result = await apiRequestAuthed<{ tables: AdminTable[] }>('/api/admin/tables');
  return result.tables;
}

export async function fetchOpenSessions() {
  const result = await apiRequestAuthed<{ sessions: OpenSession[] }>('/api/admin/sessions?status=open');
  return result.sessions;
}

export async function openTableSession(tableId: string) {
  return apiRequestAuthed<{ session: { id: string }; pin: string }>(
    `/api/admin/tables/${tableId}/sessions`,
    { method: 'POST' },
  );
}

export async function closeSession(sessionId: string) {
  return apiRequestAuthed<{ session: { id: string; status: string } }>(
    `/api/admin/sessions/${sessionId}/close`,
    { method: 'POST' },
  );
}

export async function createTable(tableNumber: string, isActive: boolean) {
  const result = await apiRequestAuthed<{ table: AdminTable }>('/api/admin/tables', {
    method: 'POST',
    body: JSON.stringify({ tableNumber, isActive }),
  });
  return result.table;
}

export async function updateTable(tableId: string, data: { tableNumber?: string; isActive?: boolean }) {
  const result = await apiRequestAuthed<{ table: AdminTable }>(`/api/admin/tables/${tableId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return result.table;
}

export async function loadTableQrObjectUrl(tableId: string): Promise<string> {
  const token = getAuthBridge()?.getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  const response = await fetch(`${getApiUrl()}/api/admin/tables/${tableId}/qr?format=png`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Could not load QR image');
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
