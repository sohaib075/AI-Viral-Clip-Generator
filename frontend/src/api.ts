import { API_URL } from './config';

const TOKEN_KEY = 'clipgenius.apiToken';

// Fired when the server rejects the stored access token, so the app can ask for it again
export const AUTH_REQUIRED_EVENT = 'clipgenius:auth-required';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';

export const setToken = (token: string) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Rendered media is served by the backend under /temp/...
export const mediaUrl = (path?: string | null) => {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
};

// Calls the backend API: adds the access token, parses JSON and turns error responses into ApiError
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Could not reach the server. Make sure the backend is running.', 0);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && data?.tokenRequired) {
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    }
    throw new ApiError(data?.error || `Request failed (${response.status})`, response.status);
  }
  return data as T;
}

export const errorMessage = (err: unknown, fallback = 'Something went wrong.') =>
  err instanceof Error && err.message ? err.message : fallback;
