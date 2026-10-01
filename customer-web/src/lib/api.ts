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

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  return JSON.parse(text) as unknown;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string; idempotencyKey?: string } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

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

export function getApiUrl() {
  return API_URL;
}

export function resolveMediaUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) {
    return null;
  }
  url = trimmed;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const base = API_URL.replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}
