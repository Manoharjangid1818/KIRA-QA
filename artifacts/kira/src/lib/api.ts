export class ApiError extends Error {
  status: number;
  
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export function getToken() {
  return localStorage.getItem('kira_auth_token');
}

export function setToken(token: string) {
  localStorage.setItem('kira_auth_token', token);
}

export function removeToken() {
  localStorage.removeItem('kira_auth_token');
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '') + '/api';
  const url = baseUrl + (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);
  
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  
  const token = getToken();
  if (token && !options.headers?.hasOwnProperty('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      // Only treat this as a session expiry (and redirect) if we actually
      // sent a token that got rejected. An anonymous /auth/me probe on
      // /login or /register is *expected* to 401 and must not redirect --
      // otherwise unauthenticated visitors get bounced off /register back
      // to /login before they can even see the form.
      const hadToken = Boolean(token);
      removeToken();
      if (hadToken) {
        window.dispatchEvent(new Event('auth_error'));
      }
    }
    const detail = data.detail;
    const message =
      Array.isArray(detail)
        ? detail.map((e: any) => e.msg ?? String(e)).join('; ')
        : typeof detail === 'string'
        ? detail
        : data.message ?? 'An error occurred';
    throw new ApiError(response.status, message);
  }

  return data as T;
}
