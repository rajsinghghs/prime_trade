/**
 * PrimeTrade API Client
 * Handles all communication with the backend REST API.
 */

const BASE_URL = 'http://localhost:8000/api/v1';

const TokenStore = {
  get access() { return localStorage.getItem('pt_access_token'); },
  get refresh() { return localStorage.getItem('pt_refresh_token'); },
  set(access, refresh) {
    localStorage.setItem('pt_access_token', access);
    if (refresh) localStorage.setItem('pt_refresh_token', refresh);
  },
  clear() {
    localStorage.removeItem('pt_access_token');
    localStorage.removeItem('pt_refresh_token');
    localStorage.removeItem('pt_user');
  },
};

const UserStore = {
  get() { try { return JSON.parse(localStorage.getItem('pt_user')); } catch { return null; } },
  set(user) { localStorage.setItem('pt_user', JSON.stringify(user)); },
};

class APIError extends Error {
  constructor(message, status, errorCode) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }
}

async function request(path, options = {}, retry = true) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (API.TokenStore.access) {
    headers['Authorization'] = `Bearer ${API.TokenStore.access}`;
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch (e) {
    throw new APIError('Network error — is the server running?', 0);
  }

  // Auto-refresh on 401
  if (res.status === 401 && retry && TokenStore.refresh) {
    const refreshed = await tryRefresh();
    if (refreshed) return request(path, options, false);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.detail || `HTTP ${res.status}`;
    throw new APIError(
      Array.isArray(msg) ? msg.map(e => e.msg).join(', ') : msg,
      res.status,
      data.error_code
    );
  }

  return data;
}

async function tryRefresh() {
  try {
    const data = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: TokenStore.refresh }),
    }).then(r => r.json());

    if (data.access_token) {
      TokenStore.set(data.access_token, data.refresh_token);
      return true;
    }
  } catch {}
  TokenStore.clear();
  return false;
}

// ─── Auth API ──────────────────────────────────────────────────────────────────
const Auth = {
  async register(payload) {
    return request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  },
  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    TokenStore.set(data.access_token, data.refresh_token);
    return data;
  },
  async me() {
    const user = await request('/auth/me');
    UserStore.set(user);
    return user;
  },
  async logout() {
    await request('/auth/logout', { method: 'POST' }).catch(() => {});
    TokenStore.clear();
  },
};

// ─── Tasks API ─────────────────────────────────────────────────────────────────
const Tasks = {
  list(params = {}) {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    );
    return request(`/tasks/?${q}`);
  },
  get(id) { return request(`/tasks/${id}`); },
  create(payload) { return request('/tasks/', { method: 'POST', body: JSON.stringify(payload) }); },
  update(id, payload) { return request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }); },
  delete(id) { return request(`/tasks/${id}`, { method: 'DELETE' }); },
};

// ─── Admin API ─────────────────────────────────────────────────────────────────
const Admin = {
  listUsers() { return request('/admin/users'); },
  updateUser(id, payload) { return request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }); },
  deactivateUser(id) { return request(`/admin/users/${id}`, { method: 'DELETE' }); },
};

window.API = {
  Auth,
  Tasks,
  Admin,
  TokenStore,
  UserStore,
  APIError
};