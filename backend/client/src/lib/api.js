/**
 * Centralized API client module.
 */

// The dashboard is served by the same Express app that exposes the API, so
// every call is same-origin and relative. Keeping this empty is what makes the
// app portable across localhost, Azure and Hostinger with no rebuild.
export const API_BASE_URL = '';

/**
 * Fetch wrapper that attaches auth token if present.
 */
export async function fetchJson(path, options = {}) {
  const token = sessionStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `${path} returned status ${res.status}`);
  }

  return res.json();
}
