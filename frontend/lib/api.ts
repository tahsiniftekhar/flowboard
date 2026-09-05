import { API_URL, SESSION_EXPIRED_EVENT } from './constants';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, token?: string | null, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('content-type') && !(init?.body instanceof FormData)) {
    headers.set('content-type', 'application/json');
  }
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    if (token && response.status === 401) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
    }
    const rawText = await response.text();
    let errorMessage = rawText;
    try {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed.message)) {
        errorMessage = parsed.message.join(', ');
      } else if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
        errorMessage = parsed.message;
      } else if (typeof parsed.error === 'string') {
        errorMessage = parsed.error;
      }
    } catch {
      // fallback to rawText if not valid JSON
    }
    throw new ApiError(
      response.status,
      errorMessage || `Request failed with status ${response.status}`,
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}
