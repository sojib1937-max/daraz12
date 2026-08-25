// API client — same-origin fetch with credentials, CSRF double-submit header,
// consistent error normalization. Never exposes raw server errors.
// Sessions can travel via httpOnly cookie OR the X-*-Token header (needed in
// environments where third-party cookies are blocked, e.g. embedded previews).
import type { ApiEnvelope } from './types';

function getCookie(name: string): string | undefined {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

const ADMIN_TOKEN_KEY = 'dc_admin_token';
const CUSTOMER_TOKEN_KEY = 'dc_customer_token';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}
function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Session tokens for header-based auth (works even where cookies are blocked). */
export const sessionTokens = {
  getAdmin: () => safeGet(ADMIN_TOKEN_KEY),
  setAdmin: (t: string) => safeSet(ADMIN_TOKEN_KEY, t),
  clearAdmin: () => safeRemove(ADMIN_TOKEN_KEY),
  getCustomer: () => safeGet(CUSTOMER_TOKEN_KEY),
  setCustomer: (t: string) => safeSet(CUSTOMER_TOKEN_KEY, t),
  clearCustomer: () => safeRemove(CUSTOMER_TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(method: string, path: string, body?: unknown, opts: { formData?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (opts.formData) {
    payload = opts.formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  // CSRF: double-submit — echo the cookie value in the header for state changes.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCookie('dc_csrf');
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  // Session tokens (header mode) — sent on every request when present.
  const adminToken = sessionTokens.getAdmin();
  if (adminToken) headers['X-Admin-Token'] = adminToken;
  const customerToken = sessionTokens.getCustomer();
  if (customerToken) headers['X-Customer-Token'] = customerToken;

  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: payload, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  }

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || !json?.success) {
    const err = json?.error;
    // 401 on admin API = session expired — handled by callers.
    throw new ApiError(res.status, err?.code || 'ERROR', err?.message || 'Something went wrong. Please try again.', err?.details);
  }
  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown, opts?: { formData?: FormData }) => request<T>('POST', path, body, opts),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export function friendlyError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}

/** Download helper for CSV/Excel exports. */
export async function downloadExport(path: string, filename: string) {
  const res = await fetch(path, { credentials: 'include' });
  if (!res.ok) throw new ApiError(res.status, 'EXPORT_FAILED', 'Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
