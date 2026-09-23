// Real API client — every function here calls the live backend. No mock data, no local
// arrays standing in for the database. Set VITE_API_URL (or edit API_BASE below) to point
// at your running backend, e.g. http://localhost:4000/api in dev.

const API_BASE = import.meta?.env?.VITE_API_URL || 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('roplant_token');
}
function setToken(token) {
  if (token) localStorage.setItem('roplant_token', token);
  else localStorage.removeItem('roplant_token');
}

async function request(path, { method = 'GET', body, auth = true } = {}) {  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try { data = await res.json(); } catch { data = null; }

  if (res.status === 401) {
    // Token missing/expired — force back to login rather than showing a confusing error.
    setToken(null);
    window.dispatchEvent(new CustomEvent('roplant:unauthorized'));
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

/** Fetches a binary PDF response and triggers a browser save-as, using the same auth token. */
async function downloadFile(path, filename) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const api = {
  // ---- Auth ----
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // ---- Dashboard ----
  dashboard: () => request('/dashboard'),
  notifications: () => request('/notifications'),

  // ---- Products & Inventory ----
  listProducts: (params = {}) => request(`/products?${new URLSearchParams(params)}`),
  getProduct: (id) => request(`/products/${id}`),
  createProduct: (product) => request('/products', { method: 'POST', body: product }),
  updateProduct: (id, product) => request(`/products/${id}`, { method: 'PUT', body: product }),
  adjustStock: (id, { direction, qty, reason }) => request(`/products/${id}/adjust`, { method: 'POST', body: { direction, qty, reason } }),
  productQr: (id) => request(`/barcode/${id}/qr`),
  lookupByCode: (code) => request(`/barcode/lookup/${encodeURIComponent(code)}`),

  // ---- Sales / POS ----
  listSales: (params = {}) => request(`/sales?${new URLSearchParams(params)}`),
  completeSale: (sale) => request('/sales', { method: 'POST', body: sale }),
  downloadSalePdf: (id) => downloadFile(`/sales/${id}/pdf`, `invoice-${id}.pdf`),
  sendSaleWhatsApp: (id) => request(`/sales/${id}/send-whatsapp`),

  // ---- Purchasing ----
  listPurchaseOrders: () => request('/purchasing'),
  createPurchaseOrder: (po) => request('/purchasing', { method: 'POST', body: po }),
  receivePurchaseOrder: (id, lines) => request(`/purchasing/${id}/receive`, { method: 'POST', body: { lines } }),

  // ---- Customers ----
  listCustomers: () => request('/customers'),
  createCustomer: (customer) => request('/customers', { method: 'POST', body: customer }),
  updateCustomer: (id, customer) => request(`/customers/${id}`, { method: 'PUT', body: customer }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),
  customerStatement: (id) => request(`/customers/${id}/statement`),
  payCustomer: (id, amount, method) => request(`/customers/${id}/pay`, { method: 'POST', body: { amount, method } }),
  sendCustomerWhatsApp: (id) => request(`/customers/${id}/send-whatsapp`, { method: 'POST' }),

  // ---- Suppliers ----
  listSuppliers: () => request('/suppliers'),
  createSupplier: (supplier) => request('/suppliers', { method: 'POST', body: supplier }),
  updateSupplier: (id, supplier) => request(`/suppliers/${id}`, { method: 'PUT', body: supplier }),
  deleteSupplier: (id) => request(`/suppliers/${id}`, { method: 'DELETE' }),
  paySupplier: (id, amount, method) => request(`/suppliers/${id}/pay`, { method: 'POST', body: { amount, method } }),

  // ---- Returns ----
  listReturns: () => request('/returns'),
  createReturn: (payload) => request('/returns', { method: 'POST', body: payload }),

  // ---- Quotations ----
  listQuotations: () => request('/quotations'),
  createQuotation: (quotation) => request('/quotations', { method: 'POST', body: quotation }),
  downloadQuotationPdf: (id) => downloadFile(`/quotations/${id}/pdf`, `quotation-${id}.pdf`),

  // ---- Stocktake ----
  listStocktakes: () => request('/stocktake'),
  getStocktake: (id) => request(`/stocktake/${id}`),
  startStocktake: () => request('/stocktake', { method: 'POST' }),
  recordCounts: (id, counts) => request(`/stocktake/${id}/count`, { method: 'PUT', body: { counts } }),
  approveStocktake: (id) => request(`/stocktake/${id}/approve`, { method: 'POST' }),

  // ---- Reports ----
  reportInventoryValuation: () => request('/reports/inventory-valuation'),
  reportSales: (params = {}) => request(`/reports/sales?${new URLSearchParams(params)}`),
  reportProfit: () => request('/reports/profit'),
  reportCustomerBalances: () => request('/reports/customer-balances'),
  reportSupplierBalances: () => request('/reports/supplier-balances'),
  reportLowStock: () => request('/reports/low-stock'),
  reportTrialBalance: () => request('/reports/trial-balance'),
  reportProfitAndLoss: (params = {}) => request(`/reports/profit-and-loss?${new URLSearchParams(params)}`),
  reportBalanceSheet: () => request('/reports/balance-sheet'),

  // ---- Settings, Users, Audit ----
  getSettings: () => request('/settings'),
  updateSettings: (settings) => request('/settings', { method: 'PUT', body: settings }),
  listUsers: () => request('/users'),
  createUser: (user) => request('/users', { method: 'POST', body: user }),
  setUserStatus: (id, status) => request(`/users/${id}/status`, { method: 'PUT', body: { status } }),
  auditLog: (limit = 100) => request(`/audit?limit=${limit}`),
};

export { setToken, getToken };
