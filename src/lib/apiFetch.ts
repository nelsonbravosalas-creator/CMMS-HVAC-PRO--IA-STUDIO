export function getAuthToken() {
  return sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token') || '';
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
