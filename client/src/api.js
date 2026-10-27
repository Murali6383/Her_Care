
const TOKEN_KEY = 'hercare_token';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ''
).replace(/\/+$/, '');

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = (token) =>
  token
    ? localStorage.setItem(TOKEN_KEY, token)
    : localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(message, status = 0, fields = null) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const normalizedPath = path.startsWith('/')
    ? path
    : `/${path}`;

  const url = `${API_BASE_URL}/api${normalizedPath}`;

  let res;

  try {
    res = await fetch(url, {
      method,
      headers,
      body: form || (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(
      'Cannot reach the server. Check your connection and try again.'
    );
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && token) {
    window.dispatchEvent(new Event('hercare:unauthorized'));
  }

  if (!res.ok) {
    throw new ApiError(
      data.error || 'Something went wrong. Please try again.',
      res.status,
      data.fields || null
    );
  }

  return data;
}
