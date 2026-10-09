import { getAuthBridge, type StaffUser } from '../auth/sessionBridge';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export type ApiError = { code: string; message: string };

export class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type TokenPairResponse = {
  accessToken: string;
  refreshToken: string;
  admin: StaffUser;
};

let refreshInFlight: Promise<string | null> | null = null;

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  return JSON.parse(text) as unknown;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    const hint =
      import.meta.env.PROD && API_URL.includes('localhost')
        ? 'VITE_API_URL was not set at build time (still pointing at localhost). In Vercel → Environment, set VITE_API_URL to your Render API URL, then redeploy.'
        : `Check that the API is running (${API_URL}/health), VITE_API_URL on Vercel matches Render, and Render CORS_ORIGINS includes this admin site URL.`;
    throw new Error(`Cannot reach API at ${API_URL}. ${hint}`);
  }

  const body = await parseJson(response);
  if (!response.ok) {
    const error = (body as { error?: ApiError }).error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? `Request failed (${response.status})`,
    );
  }
  return body as T;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const auth = getAuthBridge();
    const refreshToken = auth?.getRefreshToken();
    if (!auth || !refreshToken) {
      auth?.clearSession();
      return null;
    }

    try {
      const result = await apiRequest<TokenPairResponse>('/api/admin/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
      auth.applyTokens(result.accessToken, result.refreshToken, result.admin);
      return result.accessToken;
    } catch {
      auth.clearSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function bootstrapStaffSession(refreshToken: string): Promise<TokenPairResponse | null> {
  try {
    return await apiRequest<TokenPairResponse>('/api/admin/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return null;
  }
}

export async function apiRequestAuthed<T>(path: string, options: RequestInit = {}): Promise<T> {
  const auth = getAuthBridge();
  const accessToken = auth?.getAccessToken();
  if (!auth || !accessToken) {
    throw new ApiRequestError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    return await apiRequest<T>(path, { ...options, token: accessToken });
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401 || error.code !== 'INVALID_TOKEN') {
      throw error;
    }
    const nextToken = await refreshAccessToken();
    if (!nextToken) {
      throw error;
    }
    return await apiRequest<T>(path, { ...options, token: nextToken });
  }
}

export async function wakeDatabase() {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok) {
    throw new Error('Health check failed');
  }
  return (await response.json()) as { status: string; db: string };
}

export function getApiUrl() {
  return API_URL;
}

export function resolveMediaUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const base = API_URL.replace(/\/$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}
