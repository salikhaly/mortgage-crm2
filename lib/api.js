// lib/api.js
// Все вызовы к бэкенду из фронтенда
// Использует JWT токен из localStorage

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('crm_token') || ''
}

function headers(extra = {}) {
  return {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${getToken()}`,
    ...extra,
  }
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: headers(),
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  })

  if (res.status === 401) {
    // Токен истёк — разлогиниваем
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    window.location.reload()
    return
  }

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }

  return data
}

// ─── AUTH ────────────────────────────────────────────────
export const api = {
  // POST /api/auth/login
  login: (login, pwd) =>
    request('/api/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ login, pwd }),
    }),

  // ─── CLIENTS ───────────────────────────────────────────
  getClients: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/clients${qs ? '?' + qs : ''}`)
  },

  getClient: (id) => request(`/api/clients/${id}`),

  createClient: (client) =>
    request('/api/clients', {
      method: 'POST',
      body:   JSON.stringify(client),
    }),

  updateClient: (id, client) =>
    request(`/api/clients/${id}`, {
      method: 'PUT',
      body:   JSON.stringify(client),
    }),

  deleteClient: (id) =>
    request(`/api/clients/${id}`, { method: 'DELETE' }),

  // ─── MANAGERS ──────────────────────────────────────────
  getManagers: () => request('/api/managers'),

  createManager: (mgr) =>
    request('/api/managers', {
      method: 'POST',
      body:   JSON.stringify(mgr),
    }),

  updateManager: (id, mgr) =>
    request(`/api/managers/${id}`, {
      method: 'PUT',
      body:   JSON.stringify(mgr),
    }),

  deleteManager: (id) =>
    request(`/api/managers/${id}`, { method: 'DELETE' }),

  // ─── USERS ─────────────────────────────────────────────
  getUsers: () => request('/api/users'),

  createUser: (user) =>
    request('/api/users', {
      method: 'POST',
      body:   JSON.stringify(user),
    }),

  updateUser: (id, user) =>
    request(`/api/users/${id}`, {
      method: 'PUT',
      body:   JSON.stringify(user),
    }),

  deleteUser: (id) =>
    request(`/api/users/${id}`, { method: 'DELETE' }),

  // ─── PIPELINE ──────────────────────────────────────────
  getPipeline: () => request('/api/pipeline'),

  updatePipeline: (stages) =>
    request('/api/pipeline', {
      method: 'PUT',
      body:   JSON.stringify({ stages }),
    }),

  // ─── CHECKLISTS ────────────────────────────────────────
  getChecklists: () => request('/api/checklists'),

  updateChecklist: (stage_name, items) =>
    request('/api/checklists', {
      method: 'PUT',
      body:   JSON.stringify({ stage_name, items }),
    }),

  // ─── WHATSAPP ──────────────────────────────────────────
  getWaChats: () => request('/api/wa/chats'),

  getWaMessages: (chatId) =>
    request(`/api/wa/chats?id=${encodeURIComponent(chatId)}&mark_read=1`),

  sendWaMessage: (chatId, phone, text, author) =>
    request('/api/wa/send', {
      method: 'POST',
      body:   JSON.stringify({ chatId, phone, text, author }),
    }),

  // ─── DASHBOARD ─────────────────────────────────────────
  getDashboard: () => request('/api/dashboard'),

  // ─── KPI ───────────────────────────────────────────────
  getKPI: (period = 'month') => request(`/api/kpi?period=${period}`),

  // ─── TASKS ─────────────────────────────────────────────
  getTasks: (status = 'open') => request(`/api/tasks?status=${status}`),

  // ─── SEARCH ────────────────────────────────────────────
  search: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/search?${qs}`)
  },
}
