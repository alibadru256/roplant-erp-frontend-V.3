import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Truck, Users, Building2, RotateCcw,
  BarChart3, ShieldCheck, Settings as SettingsIcon, Search, Sun, Moon, Bell,
  ChevronDown, Plus, Pencil, Trash2, AlertTriangle, QrCode, X, Download,
  ArrowUpRight, ArrowDownRight, CheckCircle2, History, Printer, Wallet,
  FileText, Minus, LogOut, Menu, TrendingUp, TrendingDown, ClipboardList,
  Warehouse, ArrowDownCircle, ArrowUpCircle, Boxes, PackageX, Camera, MessageCircle, Send
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';

/* ============================== THEME TOKENS ============================== */
const THEMES = {
  dark: {
    bg: '#14181C', surface: '#1B2126', surfaceAlt: '#20272D', surfaceHover: '#242C33',
    border: '#2A323A', text: '#EDEFF1', textMuted: '#8B95A0', textFaint: '#5C6670',
    accent: '#E8622C', accentHover: '#D9531F', accentSoft: 'rgba(232,98,44,0.15)',
    steel: '#5A9BC4', steelSoft: 'rgba(90,155,196,0.15)',
    success: '#4FAE74', successSoft: 'rgba(79,174,116,0.15)',
    warning: '#D9A441', warningSoft: 'rgba(217,164,65,0.15)',
    danger: '#D9614F', dangerSoft: 'rgba(217,97,79,0.15)',
    chartGrid: '#2A323A'
  },
  light: {
    bg: '#F3F4F5', surface: '#FFFFFF', surfaceAlt: '#F0F1F2', surfaceHover: '#E9EBED',
    border: '#DEE2E5', text: '#1B2126', textMuted: '#5C666D', textFaint: '#8B95A0',
    accent: '#D9531F', accentHover: '#C1461A', accentSoft: 'rgba(217,83,31,0.10)',
    steel: '#2F6690', steelSoft: 'rgba(47,102,144,0.10)',
    success: '#2F8A57', successSoft: 'rgba(47,138,87,0.10)',
    warning: '#B9832A', warningSoft: 'rgba(185,131,42,0.10)',
    danger: '#B9432F', dangerSoft: 'rgba(185,67,47,0.10)',
    chartGrid: '#E3E6E8'
  }
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');`;

/* ============================== API CLIENT ============================== */
/**
 * Single centralized gateway to the real backend — no component below calls fetch() directly.
 * Points at API_BASE (override with window.__ROPLANT_API_BASE__ if you deploy the backend
 * somewhere other than localhost:4000). Tokens live in localStorage — that's a session
 * credential, not permanent business data, so it doesn't violate "localStorage must not be
 * the ERP database": every actual business record still comes from a fetch() call here, never
 * from a value read out of storage.
 *
 * NOTE ON THIS PREVIEW: clicking around in Claude's artifact preview cannot reach a backend
 * running on your machine or Codespace — there is no network path from this sandboxed iframe
 * to localhost:4000. Every API call below will correctly fail with a network error here. Run
 * this same file with `npm run dev` in the frontend project (see backend/README.md) alongside
 * the real backend for it to actually work — the code is identical either way.
 */
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000/api';

function getToken() { return typeof localStorage !== 'undefined' ? localStorage.getItem('roplant_token') : null; }
function getRefreshToken() { return typeof localStorage !== 'undefined' ? localStorage.getItem('roplant_refresh') : null; }
function setTokens(token, refreshToken) {
  if (typeof localStorage === 'undefined') return;
  if (token) localStorage.setItem('roplant_token', token); else localStorage.removeItem('roplant_token');
  if (refreshToken) localStorage.setItem('roplant_refresh', refreshToken); else localStorage.removeItem('roplant_refresh');
}

let refreshInFlight = null;
async function apiRequest(path, { method = 'GET', body, auth = true, retry = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) { const t = getToken(); if (t) headers.Authorization = `Bearer ${t}`; }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (networkErr) {
    throw new Error('Cannot reach the backend API. Is it running, and is API_BASE correct? (See the note in the API client.)');
  }

  // Access token expired — try the refresh token once before giving up, per Phase 3's
  // "refresh page, keep working" requirement (a 15-minute access token would otherwise log
  // someone out mid-task).
  if (res.status === 401 && auth && retry && getRefreshToken()) {
    if (!refreshInFlight) {
      refreshInFlight = apiRequest('/auth/refresh', { method: 'POST', body: { refreshToken: getRefreshToken() }, auth: false })
        .then((data) => { setTokens(data.token, data.refreshToken); return true; })
        .catch(() => { setTokens(null, null); return false; })
        .finally(() => { refreshInFlight = null; });
    }
    const refreshed = await refreshInFlight;
    if (refreshed) return apiRequest(path, { method, body, auth, retry: false });
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty body, e.g. 204 */ }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function saleFromApi(row) {
  return {
    id: row.id, invoiceNo: row.invoice_no, date: (row.created_at || '').slice(0, 10),
    customerId: row.customer_id, customerName: row.customer_name,
    items: (row.items || []).map(i => ({ productId: i.productId, sku: i.sku, name: i.name, qty: i.qty, price: Number(i.unitPrice), cost: Number(i.unitCost) })),
    subtotal: Number(row.subtotal), discount: Number(row.discount), tax: Number(row.tax), total: Number(row.total),
    paymentMethod: row.payment_method, status: row.status, servedBy: row.served_by, createdAt: row.created_at,
  };
}

function productFromApi(row) {
  return {
    id: row.id, sku: row.sku, partNumber: row.part_number || '', barcode: row.barcode || '',
    name: row.name, category: row.category, brand: row.brand || '', compatibility: row.compatibility || '',
    costPrice: Number(row.cost_price), sellPrice: Number(row.sell_price), stockQty: row.stock_qty,
    reorderLevel: row.reorder_level, maxStock: row.max_stock, primarySupplierId: row.primary_supplier_id,
    rack: row.rack || '', shelfBin: row.shelf_bin || '', image: row.image || '', active: row.active,
    updatedAt: row.updated_at, createdAt: row.created_at,
  };
}

function settingsFromApi(row) {
  return {
    name: row.company_name, tagline: row.tagline || '', shopLocation: row.shop_location || '',
    poBox: row.po_box || '', cityCountry: row.city_country || '', address: row.address || '',
    phone: row.phone || '', phone2: row.phone2 || '', email: row.email || '', currency: row.currency,
    taxRate: Number(row.tax_rate), invoicePrefix: row.invoice_prefix, receiptFooter: row.receipt_footer || '',
    logo: row.logo || '',
  };
}
function settingsToApi(ci) {
  return {
    companyName: ci.name, tagline: ci.tagline, shopLocation: ci.shopLocation, poBox: ci.poBox,
    cityCountry: ci.cityCountry, address: ci.address, phone: ci.phone, phone2: ci.phone2,
    email: ci.email, currency: ci.currency, taxRate: ci.taxRate, invoicePrefix: ci.invoicePrefix,
    receiptFooter: ci.receiptFooter, logo: ci.logo,
  };
}

const api = {
  login: (username, password) => apiRequest('/auth/login', { method: 'POST', body: { email: username, password }, auth: false }),
  logout: (refreshToken) => apiRequest('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => {}),
  me: () => apiRequest('/auth/me'),

  dashboard: () => apiRequest('/dashboard'),

  listProducts: (params = {}) => apiRequest(`/products?${new URLSearchParams(params)}`),
  createProduct: (product) => apiRequest('/products', { method: 'POST', body: product }),
  updateProduct: (id, product) => apiRequest(`/products/${id}`, { method: 'PUT', body: product }),
  adjustStock: (id, body) => apiRequest(`/products/${id}/adjust`, { method: 'POST', body }),

  listSales: (params = {}) => apiRequest(`/sales?${new URLSearchParams(params)}`),
  createSale: (sale) => apiRequest('/sales', { method: 'POST', body: sale }),

  listCategories: () => apiRequest('/categories'),

  getSettings: () => apiRequest('/settings'),
  updateSettings: (settings) => apiRequest('/settings', { method: 'PUT', body: settings }),
};

/* ============================== MOCK DATA ============================== */
const CATEGORIES = ['Engine Parts', 'Hydraulics', 'Filters', 'Electrical', 'Transmission', 'Brakes', 'Tyres & Wheels', 'Belts & Chains'];
const BRANDS = ['Massey Ferguson', 'John Deere', 'New Holland', 'Case IH', 'Generic/Aftermarket'];
const LOCATIONS = ['Warehouse A - Rack 1', 'Warehouse A - Rack 2', 'Warehouse B - Rack 1', 'Shopfront Shelf'];

let idCounter = 1000;
const nextId = () => ++idCounter;

const CATEGORY_ICON_COLORS = {
  'Engine Parts': '#D9531F', 'Hydraulics': '#2F6690', 'Filters': '#2F8A57', 'Electrical': '#B9832A',
  'Transmission': '#6B5FB0', 'Brakes': '#B9432F', 'Tyres & Wheels': '#5C666D', 'Belts & Chains': '#2F8A9C',
};
const CATEGORY_ICON_MARKUP = {
  'Engine Parts': `<circle cx="150" cy="150" r="90" fill="none" stroke="#fff" stroke-width="10"/><circle cx="150" cy="150" r="38" fill="none" stroke="#fff" stroke-width="10"/><circle cx="150" cy="70" r="9" fill="#fff"/><circle cx="150" cy="230" r="9" fill="#fff"/><circle cx="70" cy="150" r="9" fill="#fff"/><circle cx="230" cy="150" r="9" fill="#fff"/><circle cx="99" cy="99" r="9" fill="#fff"/><circle cx="201" cy="201" r="9" fill="#fff"/><circle cx="99" cy="201" r="9" fill="#fff"/><circle cx="201" cy="99" r="9" fill="#fff"/>`,
  'Hydraulics': `<rect x="85" y="120" width="130" height="70" rx="10" fill="none" stroke="#fff" stroke-width="10"/><rect x="55" y="140" width="32" height="30" rx="6" fill="#fff"/><line x1="150" y1="120" x2="150" y2="70" stroke="#fff" stroke-width="10"/><circle cx="150" cy="58" r="13" fill="#fff"/><line x1="120" y1="190" x2="120" y2="235" stroke="#fff" stroke-width="10"/><line x1="180" y1="190" x2="180" y2="235" stroke="#fff" stroke-width="10"/>`,
  'Filters': `<rect x="108" y="55" width="84" height="190" rx="16" fill="none" stroke="#fff" stroke-width="10"/><line x1="130" y1="78" x2="130" y2="222" stroke="#fff" stroke-width="6"/><line x1="150" y1="78" x2="150" y2="222" stroke="#fff" stroke-width="6"/><line x1="170" y1="78" x2="170" y2="222" stroke="#fff" stroke-width="6"/><ellipse cx="150" cy="55" rx="42" ry="14" fill="#fff"/>`,
  'Electrical': `<rect x="88" y="98" width="124" height="124" rx="14" fill="none" stroke="#fff" stroke-width="10"/><rect x="128" y="76" width="44" height="22" rx="4" fill="#fff"/><path d="M168 128 L134 178 L156 178 L132 224 L188 164 L163 164 Z" fill="#fff"/>`,
  'Transmission': `<circle cx="150" cy="150" r="55" fill="none" stroke="#fff" stroke-width="12"/><circle cx="150" cy="150" r="18" fill="#fff"/><g stroke="#fff" stroke-width="15" stroke-linecap="round"><line x1="150" y1="78" x2="150" y2="58"/><line x1="150" y1="222" x2="150" y2="242"/><line x1="78" y1="150" x2="58" y2="150"/><line x1="222" y1="150" x2="242" y2="150"/><line x1="97" y1="97" x2="82" y2="82"/><line x1="203" y1="203" x2="218" y2="218"/><line x1="97" y1="203" x2="82" y2="218"/><line x1="203" y1="97" x2="218" y2="82"/></g>`,
  'Brakes': `<circle cx="150" cy="150" r="90" fill="none" stroke="#fff" stroke-width="10"/><circle cx="150" cy="150" r="26" fill="none" stroke="#fff" stroke-width="8"/><circle cx="150" cy="88" r="8" fill="#fff"/><circle cx="150" cy="212" r="8" fill="#fff"/><circle cx="88" cy="150" r="8" fill="#fff"/><circle cx="212" cy="150" r="8" fill="#fff"/><circle cx="107" cy="107" r="8" fill="#fff"/><circle cx="193" cy="193" r="8" fill="#fff"/><circle cx="107" cy="193" r="8" fill="#fff"/><circle cx="193" cy="107" r="8" fill="#fff"/>`,
  'Tyres & Wheels': `<circle cx="150" cy="150" r="96" fill="none" stroke="#fff" stroke-width="18"/><circle cx="150" cy="150" r="56" fill="none" stroke="#fff" stroke-width="9"/><circle cx="150" cy="150" r="15" fill="#fff"/>`,
  'Belts & Chains': `<circle cx="102" cy="150" r="36" fill="none" stroke="#fff" stroke-width="10"/><circle cx="198" cy="150" r="36" fill="none" stroke="#fff" stroke-width="10"/><line x1="102" y1="113" x2="198" y2="113" stroke="#fff" stroke-width="8"/><line x1="102" y1="187" x2="198" y2="187" stroke="#fff" stroke-width="8"/>`,
};
function categoryIconDataUri(category) {
  const bg = CATEGORY_ICON_COLORS[category] || '#5C666D';
  const icon = CATEGORY_ICON_MARKUP[category] || CATEGORY_ICON_MARKUP['Engine Parts'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" rx="28" fill="${bg}"/>${icon}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const initialProducts = [
  { id: 1, sku: 'ENG-0001', partNumber: 'MF-3610245', barcode: '8901234500011', name: 'Cylinder Head Gasket', category: 'Engine Parts', brand: 'Massey Ferguson', compatibility: 'MF 240, MF 375', costPrice: 85000, sellPrice: 135000, stockQty: 14, reorderLevel: 5, maxStock: 20, primarySupplierId: 1, location: 'Warehouse A - Rack 1', image: 'https://loremflickr.com/300x300/engine,gasket?lock=1' },
  { id: 2, sku: 'HYD-0002', partNumber: 'JD-RE12345', barcode: '8901234500028', name: 'Hydraulic Lift Pump', category: 'Hydraulics', brand: 'John Deere', compatibility: 'JD 5310, JD 5075E', costPrice: 420000, sellPrice: 610000, stockQty: 3, reorderLevel: 4, maxStock: 15, primarySupplierId: 2, location: 'Warehouse A - Rack 2', image: 'https://loremflickr.com/300x300/hydraulic,pump?lock=2' },
  { id: 3, sku: 'FLT-0003', partNumber: 'NH-84475542', barcode: '8901234500035', name: 'Oil Filter Cartridge', category: 'Filters', brand: 'New Holland', compatibility: 'NH TT75, NH 3630', costPrice: 12000, sellPrice: 22000, stockQty: 62, reorderLevel: 20, maxStock: 50, primarySupplierId: 3, location: 'Shopfront Shelf', image: 'https://loremflickr.com/300x300/oil,filter?lock=3' },
  { id: 4, sku: 'ELE-0004', partNumber: 'CIH-87654321', barcode: '8901234500042', name: 'Starter Motor 12V', category: 'Electrical', brand: 'Case IH', compatibility: 'Case IH 5130, 595', costPrice: 265000, sellPrice: 390000, stockQty: 6, reorderLevel: 3, maxStock: 20, primarySupplierId: 4, location: 'Warehouse B - Rack 1', image: 'https://loremflickr.com/300x300/starter,motor?lock=4' },
  { id: 5, sku: 'TRN-0005', partNumber: 'MF-1867233M91', barcode: '8901234500059', name: 'Clutch Plate Assembly', category: 'Transmission', brand: 'Massey Ferguson', compatibility: 'MF 375, MF 390', costPrice: 195000, sellPrice: 285000, stockQty: 9, reorderLevel: 4, maxStock: 25, primarySupplierId: 1, location: 'Warehouse A - Rack 1', image: 'https://loremflickr.com/300x300/clutch,plate?lock=5' },
  { id: 6, sku: 'BRK-0006', partNumber: 'GEN-BRK-2210', barcode: '8901234500066', name: 'Brake Shoe Set', category: 'Brakes', brand: 'Generic/Aftermarket', compatibility: 'Universal - 2WD tractors', costPrice: 48000, sellPrice: 75000, stockQty: 24, reorderLevel: 10, maxStock: 30, primarySupplierId: 4, location: 'Warehouse B - Rack 1', image: 'https://loremflickr.com/300x300/brake,shoe?lock=6' },
  { id: 7, sku: 'TYR-0007', partNumber: 'JD-TYR-1834R', barcode: '8901234500073', name: 'Rear Tyre 18.4-34', category: 'Tyres & Wheels', brand: 'John Deere', compatibility: 'JD 5310, JD 5075E', costPrice: 780000, sellPrice: 1050000, stockQty: 0, reorderLevel: 3, maxStock: 10, primarySupplierId: 2, location: 'Warehouse A - Rack 2', image: 'https://loremflickr.com/300x300/tractor,tire?lock=7' },
  { id: 8, sku: 'BLT-0008', partNumber: 'NH-BLT-5540', barcode: '8901234500080', name: 'Fan Belt Set', category: 'Belts & Chains', brand: 'New Holland', compatibility: 'NH TT75, NH 4630', costPrice: 22000, sellPrice: 38000, stockQty: 41, reorderLevel: 15, maxStock: 35, primarySupplierId: 3, location: 'Shopfront Shelf', image: 'https://loremflickr.com/300x300/fan,belt?lock=8' },
  { id: 9, sku: 'ENG-0009', partNumber: 'CIH-INJ-9042', barcode: '8901234500097', name: 'Fuel Injector Nozzle', category: 'Engine Parts', brand: 'Case IH', compatibility: 'Case IH 595, 685', costPrice: 96000, sellPrice: 148000, stockQty: 17, reorderLevel: 6, maxStock: 25, primarySupplierId: 4, location: 'Warehouse A - Rack 1', image: 'https://loremflickr.com/300x300/fuel,injector?lock=9' },
  { id: 10, sku: 'HYD-0010', partNumber: 'MF-HYD-7723', barcode: '8901234500103', name: 'Hydraulic Hose 3/4"', category: 'Hydraulics', brand: 'Massey Ferguson', compatibility: 'Universal', costPrice: 18000, sellPrice: 32000, stockQty: 55, reorderLevel: 20, maxStock: 60, primarySupplierId: 1, location: 'Warehouse B - Rack 1', image: 'https://loremflickr.com/300x300/hydraulic,hose?lock=10' },
  { id: 11, sku: 'ELE-0011', partNumber: 'GEN-BAT-12100', barcode: '8901234500110', name: 'Battery 12V 100Ah', category: 'Electrical', brand: 'Generic/Aftermarket', compatibility: 'Universal', costPrice: 310000, sellPrice: 455000, stockQty: 8, reorderLevel: 4, maxStock: 20, primarySupplierId: 4, location: 'Shopfront Shelf', image: 'https://loremflickr.com/300x300/car,battery?lock=11' },
  { id: 12, sku: 'FLT-0012', partNumber: 'JD-FLT-6620', barcode: '8901234500127', name: 'Air Filter Element', category: 'Filters', brand: 'John Deere', compatibility: 'JD 5310, JD 5075E', costPrice: 16000, sellPrice: 27000, stockQty: 4, reorderLevel: 15, maxStock: 40, primarySupplierId: 2, location: 'Shopfront Shelf', image: 'https://loremflickr.com/300x300/air,filter?lock=12' },
];

const initialCustomers = [
  { id: 1, name: 'Kigezi Agro Traders', phone: '+256 772 456 123', email: 'kigezi.agro@example.com', creditLimit: 2000000, balance: 450000 },
  { id: 2, name: 'Mbale Farm Equipment Ltd', phone: '+256 701 998 221', email: 'mbale.fe@example.com', creditLimit: 5000000, balance: 5400000 },
  { id: 3, name: 'Semanda Wilson (Walk-in)', phone: '+256 782 334 210', email: '', creditLimit: 0, balance: 0 },
  { id: 4, name: 'Northern Tractor Hub', phone: '+256 758 112 984', email: 'info@ntractorhub.example.com', creditLimit: 3000000, balance: 1200000 },
  { id: 5, name: 'Busoga Mechanization Co-op', phone: '+256 793 665 442', email: 'busoga.coop@example.com', creditLimit: 1500000, balance: 0 },
];

const initialSuppliers = [
  { id: 1, name: 'Massey Ferguson Parts (U) Ltd', phone: '+256 414 220 019', email: 'sales@mfparts.example.com', balance: 2350000 },
  { id: 2, name: 'John Deere East Africa', phone: '+256 414 556 210', email: 'orders@jdeafrica.example.com', balance: 0 },
  { id: 3, name: 'New Holland Distributors', phone: '+256 312 998 004', email: 'supply@nhd.example.com', balance: 890000 },
  { id: 4, name: 'Generic Auto Spares Kampala', phone: '+256 700 774 552', email: 'genauto@example.com', balance: 415000 },
];

const initialUsers = [
  { id: 1, name: 'Ronald Mukasa', email: 'ronald@roplantservices.com', password: '••••••••', role: 'Admin', isOwner: true, status: 'Active', lastLogin: '2026-09-05 08:12' },
  { id: 2, name: 'Grace Nabirye', email: 'grace@roplantservices.com', password: '••••••••', role: 'Manager', isOwner: false, status: 'Active', lastLogin: '2026-09-05 07:40' },
  { id: 3, name: 'David Mugisha', email: 'david@roplantservices.com', password: '••••••••', role: 'Sales', isOwner: false, status: 'Active', lastLogin: '2026-09-04 17:02' },
  { id: 4, name: 'Patience Auma', email: 'patience@roplantservices.com', password: '••••••••', role: 'Inventory', isOwner: false, status: 'Active', lastLogin: '2026-09-04 16:20' },
  { id: 5, name: 'Samuel Kato', email: 'samuel@roplantservices.com', password: '••••••••', role: 'Accountant', isOwner: false, status: 'Inactive', lastLogin: '2026-08-29 09:15' },
];

const REVENUE_TREND = [
  { month: 'Apr', revenue: 8200000, profit: 2450000 },
  { month: 'May', revenue: 9100000, profit: 2680000 },
  { month: 'Jun', revenue: 7800000, profit: 2210000 },
  { month: 'Jul', revenue: 10450000, profit: 3120000 },
  { month: 'Aug', revenue: 11200000, profit: 3390000 },
  { month: 'Sep', revenue: 4600000, profit: 1380000 },
];

const DEFAULT_PERMISSIONS = {
  Admin: ['dashboard', 'inventory', 'icc', 'stockmgmt', 'pos', 'purchasing', 'customers', 'suppliers', 'returns', 'reports', 'documents', 'whatsapp', 'users', 'settings'],
  Manager: ['dashboard', 'inventory', 'icc', 'stockmgmt', 'pos', 'purchasing', 'customers', 'suppliers', 'returns', 'reports', 'documents', 'whatsapp', 'settings'],
  Sales: ['dashboard', 'stockmgmt', 'pos', 'customers', 'returns', 'documents', 'whatsapp'],
  Inventory: ['dashboard', 'inventory', 'icc', 'stockmgmt', 'purchasing', 'returns'],
  Accountant: ['dashboard', 'icc', 'stockmgmt', 'reports', 'customers', 'suppliers', 'documents', 'whatsapp'],
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Products & Inventory', icon: Package },
  { id: 'icc', label: 'Inventory Control Center', icon: Warehouse },
  { id: 'stockmgmt', label: 'Stock Management', icon: ClipboardList },
  { id: 'pos', label: 'Sales / POS', icon: ShoppingCart },
  { id: 'documents', label: 'Quotations & Invoices', icon: FileText },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'purchasing', label: 'Purchasing', icon: Truck },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'suppliers', label: 'Suppliers', icon: Building2 },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'users', label: 'Users & Security', icon: ShieldCheck },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

/* ============================== HELPERS ============================== */
const fmt = (n) => new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const money = (n, cur) => `${cur} ${fmt(n)}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const nowStr = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

function computeNotifications(products, customers, purchaseOrders) {
  const list = [];
  products.filter(p => p.stockQty > 0 && p.stockQty <= p.reorderLevel).forEach(p =>
    list.push({ id: `low-${p.id}`, severity: 'warning', message: `${p.name} is low: ${p.stockQty} left (reorder at ${p.reorderLevel}).`, module: 'icc' }));
  products.filter(p => p.stockQty === 0).forEach(p =>
    list.push({ id: `out-${p.id}`, severity: 'danger', message: `${p.name} is out of stock.`, module: 'icc' }));
  customers.filter(c => c.creditLimit > 0 && c.balance > c.creditLimit).forEach(c =>
    list.push({ id: `credit-${c.id}`, severity: 'danger', message: `${c.name} owes ${fmt(c.balance)}, over their credit limit of ${fmt(c.creditLimit)}.`, module: 'customers' }));
  purchaseOrders.filter(po => po.status === 'Pending').forEach(po =>
    list.push({ id: `po-${po.id}`, severity: 'steel', message: `${po.poNo} to ${po.supplierName} is still awaiting receipt.`, module: 'purchasing' }));
  return list;
}

function NotificationBell({ t, products, customers, purchaseOrders, setActiveModule }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const notifications = computeNotifications(products, customers, purchaseOrders);

  useEffect(() => {
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const toneColor = (sev) => ({ warning: t.warning, danger: t.danger, steel: t.steel }[sev] || t.textMuted);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} className="p-2 rounded-md relative" style={{ background: t.surfaceAlt, border: `1px solid ${t.border}` }}>
        <Bell size={16} />
        {notifications.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ background: t.danger, color: '#fff' }}>
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-lg shadow-lg z-50 overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${t.border}` }}>
            <span className="text-sm font-semibold">Notifications</span>
            <Badge t={t} tone={notifications.length ? 'danger' : 'success'}>{notifications.length}</Badge>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && <p className="px-4 py-6 text-sm text-center" style={{ color: t.textFaint }}>All clear — nothing needs attention.</p>}
            {notifications.map(n => (
              <button key={n.id} onClick={() => { setActiveModule(n.module); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 flex items-start gap-2 text-xs" style={{ borderBottom: `1px solid ${t.border}` }}
                onMouseEnter={e => e.currentTarget.style.background = t.surfaceAlt} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: toneColor(n.severity) }} />
                <span style={{ color: t.text }}>{n.message}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function productStatus(p) {
  if (p.stockQty === 0) return 'Out of Stock';
  if (p.stockQty <= p.reorderLevel) return 'Low Stock';
  if (p.maxStock && p.stockQty > p.maxStock) return 'Overstock';
  return 'Normal';
}
function statusTone(s) {
  return { 'Out of Stock': 'danger', 'Low Stock': 'warning', 'Overstock': 'steel', 'Normal': 'success' }[s] || 'muted';
}

function numberToWords(num) {
  num = Math.round(Math.abs(num || 0));
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

  const chunkToWords = (n) => {
    let str = '';
    if (n >= 100) { str += ones[Math.floor(n / 100)] + ' Hundred '; n %= 100; }
    if (n >= 20) { str += tens[Math.floor(n / 10)] + ' '; n %= 10; }
    if (n > 0) str += ones[n] + ' ';
    return str.trim();
  };

  let result = '';
  let scaleIndex = 0;
  let n = num;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) result = `${chunkToWords(chunk)}${scales[scaleIndex] ? ' ' + scales[scaleIndex] : ''} ${result}`;
    n = Math.floor(n / 1000);
    scaleIndex++;
  }
  return result.trim();
}

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/**
 * Builds a real, valid PDF file from scratch — no PDF library available in this environment,
 * so this constructs the raw PDF object structure (objects, content stream, xref table)
 * directly. It's a genuinely different artifact from "Print" (which opens the browser's
 * print dialog): this downloads an actual .pdf file immediately, no dialog involved.
 * Layout is simpler than the on-screen letterhead (no boxes/borders, just clean text and
 * rule lines) since drawing precise tables needs real coordinate work without a layout engine.
 */
function pdfSafeText(str) {
  return String(str ?? '')
    .replace(/[—–]/g, '-').replace(/[•]/g, '-').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/×/g, 'x')
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildProformaPdfString({ companyInfo, docTitle, docNo, date, customerLines, items, subtotal, vat, total, footer }) {
  const pageW = 595, marginL = 50, marginR = 545;
  const colQty = 50, colPart = 105, colRate = 360, colAmt = 470;
  const ops = [];
  let y = 780;

  const text = (x, yy, size, str, bold) => ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${yy} Td (${pdfSafeText(str)}) Tj ET`);
  const centerText = (yy, size, str, bold) => text(Math.max(marginL, (pageW - String(str).length * size * (bold ? 0.58 : 0.48)) / 2), yy, size, str, bold);
  const hLine = (yy) => ops.push(`${marginL} ${yy} m ${marginR} ${yy} l S`);

  centerText(y, 18, companyInfo.name, true); y -= 16;
  if (companyInfo.tagline) { centerText(y, 8, companyInfo.tagline, false); y -= 11; }
  if (companyInfo.shopLocation) { centerText(y, 8, companyInfo.shopLocation, false); y -= 14; }
  text(marginL, y, 8, `${companyInfo.poBox || ''}  ${companyInfo.cityCountry || ''}`, false);
  text(300, y, 8, `Email: ${companyInfo.email || ''}`, false);
  y -= 11;
  text(marginL, y, 8, `Tel: ${companyInfo.phone || ''}  ${companyInfo.phone2 || ''}`, false);
  y -= 8;
  hLine(y); y -= 16;

  text(marginL, y, 9, docTitle, true);
  text(400, y, 9, `No: ${docNo}`, false);
  y -= 12;
  text(400, y, 9, `Date: ${date}`, false);
  y -= 14;
  (customerLines || []).forEach(line => { text(marginL, y, 9, line, false); y -= 12; });
  y -= 4;
  hLine(y); y -= 6;

  text(colQty, y, 9, 'QTY', true); text(colPart, y, 9, 'PARTICULARS', true); text(colRate, y, 9, 'RATE', true); text(colAmt, y, 9, 'AMOUNT', true);
  y -= 6; hLine(y); y -= 12;

  items.forEach(it => {
    if (y < 130) return; // simple overflow guard — very long carts are truncated on this quick-download PDF; use Print for full multi-page output
    text(colQty, y, 9, String(it.qty), false);
    text(colPart, y, 9, String(it.particulars).slice(0, 42), false);
    text(colRate, y, 9, fmt(it.rate), false);
    text(colAmt, y, 9, fmt(it.amount), false);
    y -= 14;
  });
  hLine(y + 4); y -= 6;

  text(colRate, y, 9, 'Sub Total', true); text(colAmt, y, 9, fmt(subtotal), false); y -= 13;
  text(colRate, y, 9, `VAT ${companyInfo.taxRate}%`, true); text(colAmt, y, 9, fmt(vat), false); y -= 13;
  text(colRate, y, 10, 'Total', true); text(colAmt, y, 10, fmt(total), true); y -= 22;

  centerText(y, 9, footer || 'All accounts are due on demand', true); y -= 18;
  text(marginL, y, 8, `Amount in words: ${numberToWords(total)} ${companyInfo.currency} Only`, false); y -= 40;
  text(380, y, 8, 'Signature: ________________________', false); y -= 12;
  text(380, y, 8, `For: ${companyInfo.name}`, true);

  const contentStream = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /MediaBox [0 0 595 842] /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

function downloadPdf(filename, pdfDataProps) {
  const pdfString = buildProformaPdfString(pdfDataProps);
  const bytes = new Uint8Array(pdfString.length);
  for (let i = 0; i < pdfString.length; i++) bytes[i] = pdfString.charCodeAt(i) & 0xFF;
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ProductThumb({ t, product, size = 36, rounded = 'rounded-md' }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);

  const showRealPhoto = product?.image && !photoFailed;
  const showCategoryIcon = !showRealPhoto && product?.category && !iconFailed;

  if (showRealPhoto) {
    return (
      <img src={product.image} alt={product.name} onError={() => setPhotoFailed(true)}
        className={`${rounded} object-cover shrink-0`} style={{ width: size, height: size, background: t.surfaceAlt }} />
    );
  }
  if (showCategoryIcon) {
    return (
      <img src={categoryIconDataUri(product.category)} alt={product.name} onError={() => setIconFailed(true)}
        className={`${rounded} object-cover shrink-0`} style={{ width: size, height: size, background: t.surfaceAlt }} />
    );
  }
  return (
    <div className={`${rounded} flex items-center justify-center shrink-0`} style={{ width: size, height: size, background: t.surfaceAlt }}>
      <Package size={Math.round(size * 0.45)} style={{ color: t.textFaint }} />
    </div>
  );
}

const cellStyle = { border: '1px solid #000', padding: '5px 8px', textAlign: 'center', verticalAlign: 'top' };

/**
 * Renders the exact layout of Roplant Service Ltd's real printed proforma/invoice pad:
 * big centered letterhead, P.O Box / email / phone strip, M/s customer box beside a
 * PROFORMA/INVOICE No./Date box, a QTY | PARTICULARS | RATE | AMOUNT ruled table,
 * Sub Total / VAT / Total with "E&O.E", the "All accounts are due on demand" line,
 * an auto-computed "Amount in words", and a signature line. Used for both quotations
 * and sale invoices — they're the same physical pad in real use.
 */
function ProformaDocument({ companyInfo, docTitle, docNo, date, customerLines, items, subtotal, vat, total, footer }) {
  return (
    <div id="print-area" style={{ background: '#fff', color: '#000', padding: 28, fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <div className="text-center">
        {companyInfo.logo && <img src={companyInfo.logo} alt="Company logo" style={{ height: 56, margin: '0 auto 6px', display: 'block' }} />}
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 1 }}>{companyInfo.name}</div>
        {companyInfo.tagline && <div style={{ fontSize: 12, marginTop: 2 }}>{companyInfo.tagline}</div>}
        {companyInfo.shopLocation && <div style={{ fontSize: 12 }}>{companyInfo.shopLocation}</div>}
      </div>
      <div className="flex justify-between items-start mt-2 flex-wrap gap-2" style={{ fontSize: 11 }}>
        <div>
          <div>{companyInfo.poBox}</div>
          <div>{companyInfo.cityCountry}</div>
        </div>
        <div style={{ textAlign: 'center' }}>Email: <span style={{ textDecoration: 'underline' }}>{companyInfo.email}</span></div>
        <div style={{ textAlign: 'right' }}>
          <div>Tel: {companyInfo.phone}</div>
          <div>{companyInfo.phone2}</div>
        </div>
      </div>
      <div style={{ borderTop: '2px solid #000', marginTop: 8, marginBottom: 10 }} />

      <div className="flex gap-3 flex-wrap">
        <div style={{ flex: '1.3 1 260px', border: '1px solid #000', padding: 8, minHeight: 66, fontSize: 12 }}>
          <div>M/s: {customerLines[0] || ''}</div>
          {customerLines.slice(1).map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div style={{ flex: '1 1 200px', border: '1px solid #000' }}>
          <div style={{ background: '#000', color: '#fff', textAlign: 'center', padding: '4px 0', fontWeight: 700, fontSize: 13 }}>{docTitle}</div>
          <div className="flex" style={{ borderTop: '1px solid #000' }}>
            <div style={{ padding: '4px 8px', fontSize: 12, borderRight: '1px solid #000', width: 70 }}>No.</div>
            <div style={{ padding: '4px 8px', fontSize: 12 }}>{docNo}</div>
          </div>
          <div className="flex" style={{ borderTop: '1px solid #000' }}>
            <div style={{ padding: '4px 8px', fontSize: 12, borderRight: '1px solid #000', width: 70 }}>Date</div>
            <div style={{ padding: '4px 8px', fontSize: 12 }}>{date}</div>
          </div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10, fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ ...cellStyle, fontWeight: 700, width: 60 }}>QTY</th>
            <th style={{ ...cellStyle, fontWeight: 700, textAlign: 'left' }}>PARTICULARS</th>
            <th style={{ ...cellStyle, fontWeight: 700, width: 100 }}>RATE</th>
            <th style={{ ...cellStyle, fontWeight: 700, width: 110 }}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td style={cellStyle}>{it.qty}</td>
              <td style={{ ...cellStyle, textAlign: 'left' }}>{it.particulars}</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{fmt(it.rate)}</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{fmt(it.amount)}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td style={cellStyle} colSpan={4}>&nbsp;</td></tr>}
        </tbody>
      </table>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <tbody>
          <tr>
            <td style={{ ...cellStyle, borderTop: 'none', textAlign: 'left', width: 60 }}></td>
            <td style={{ ...cellStyle, borderTop: 'none', textAlign: 'right' }}>Sub Total</td>
            <td style={{ ...cellStyle, borderTop: 'none', textAlign: 'right', width: 110 }}>{fmt(subtotal)}</td>
          </tr>
          <tr>
            <td style={{ ...cellStyle, borderTop: 'none', textAlign: 'left', fontWeight: 700 }}>E&amp;O.E</td>
            <td style={{ ...cellStyle, borderTop: 'none', textAlign: 'right' }}>VAT {companyInfo.taxRate}%</td>
            <td style={{ ...cellStyle, borderTop: 'none', textAlign: 'right' }}>{fmt(vat)}</td>
          </tr>
          <tr>
            <td style={{ ...cellStyle, borderTop: 'none' }}></td>
            <td style={{ ...cellStyle, borderTop: 'none', textAlign: 'right', fontWeight: 700 }}>Total</td>
            <td style={{ ...cellStyle, borderTop: 'none', textAlign: 'right', fontWeight: 700 }}>{fmt(total)}</td>
          </tr>
        </tbody>
      </table>

      <div className="text-center" style={{ fontWeight: 700, marginTop: 14, fontSize: 12 }}>{footer || 'All accounts are due on demand'}</div>
      <div style={{ marginTop: 16, fontSize: 12 }}>Amount in words: <i>{numberToWords(total)} {companyInfo.currency} Only</i></div>

      <div className="flex justify-end mt-8" style={{ fontSize: 12 }}>
        <div style={{ textAlign: 'right' }}>
          <div>Signature: ______________________</div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>For: {companyInfo.name}</div>
        </div>
      </div>
    </div>
  );
}

function InvoicePrintable({ sale, companyInfo, docTitle = 'INVOICE' }) {
  return (
    <ProformaDocument
      companyInfo={companyInfo}
      docTitle={docTitle}
      docNo={sale.invoiceNo}
      date={sale.date}
      customerLines={[sale.customerName, `Payment: ${sale.paymentMethod} (${sale.status}) · Served by ${sale.servedBy}`]}
      items={sale.items.map(i => ({ qty: i.qty, particulars: `${i.name} (${i.sku})`, rate: i.price, amount: i.price * i.qty }))}
      subtotal={sale.subtotal - sale.discount}
      vat={sale.tax}
      total={sale.total}
      footer={companyInfo.receiptFooter}
    />
  );
}

/* ============================== SHARED UI PRIMITIVES ============================== */
function Card({ t, children, style, className = '' }) {
  return (
    <div className={`rounded-lg ${className}`} style={{ background: t.surface, border: `1px solid ${t.border}`, ...style }}>
      {children}
    </div>
  );
}

function Btn({ t, children, onClick, variant = 'secondary', icon: Icon, disabled, type = 'button', title }) {
  const styles = {
    primary: { background: t.accent, color: '#fff', border: `1px solid ${t.accent}` },
    secondary: { background: t.surfaceAlt, color: t.text, border: `1px solid ${t.border}` },
    ghost: { background: 'transparent', color: t.textMuted, border: `1px solid transparent` },
    danger: { background: t.dangerSoft, color: t.danger, border: `1px solid ${t.danger}33` },
  };
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-opacity"
      style={{ ...styles[variant], opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: "'Inter',sans-serif" }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = 'brightness(1.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}>
      {Icon && <Icon size={15} />}{children}
    </button>
  );
}

function Badge({ t, tone = 'muted', children }) {
  const map = {
    success: { bg: t.successSoft, c: t.success }, warning: { bg: t.warningSoft, c: t.warning },
    danger: { bg: t.dangerSoft, c: t.danger }, steel: { bg: t.steelSoft, c: t.steel },
    accent: { bg: t.accentSoft, c: t.accent }, muted: { bg: t.surfaceAlt, c: t.textMuted },
  };
  const s = map[tone];
  return <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: s.bg, color: s.c }}>{children}</span>;
}

function Field({ t, label, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span style={{ color: t.textMuted }}>{label}</span>
      {children}
    </label>
  );
}

function inputStyle(t) {
  return { background: t.surfaceAlt, color: t.text, border: `1px solid ${t.border}`, fontFamily: "'Inter',sans-serif" };
}

function TInput(props) {
  const { t, ...rest } = props;
  return <input {...rest} className="px-3 py-2 rounded-md text-sm outline-none w-full" style={inputStyle(t)} />;
}
function TSelect({ t, children, ...rest }) {
  return <select {...rest} className="px-3 py-2 rounded-md text-sm outline-none w-full" style={inputStyle(t)}>{children}</select>;
}

function Modal({ t, title, onClose, children, wide, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'} rounded-lg flex flex-col`}
        style={{ background: t.surface, border: `1px solid ${t.border}`, maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h3 className="font-semibold" style={{ color: t.text, fontFamily: "'Space Grotesk',sans-serif" }}>{title}</h3>
          <button onClick={onClose}><X size={18} style={{ color: t.textMuted }} /></button>
        </div>
        <div className="p-5 overflow-y-auto" style={{ flex: '1 1 auto', minHeight: 0 }}>{children}</div>
        {footer && (
          <div className="px-5 py-4 shrink-0 flex justify-end gap-2 flex-wrap" style={{ borderTop: `1px solid ${t.border}` }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmDialog({ t, data, onClose }) {
  if (!data) return null;
  return (
    <Modal t={t} title={data.title || 'Confirm action'} onClose={onClose}
      footer={<>
        <Btn t={t} variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn t={t} variant="danger" onClick={() => { data.onConfirm(); onClose(); }}>{data.confirmLabel || 'Confirm'}</Btn>
      </>}>
      <p className="text-sm" style={{ color: t.textMuted }}>{data.message}</p>
    </Modal>
  );
}

function Toast({ t, toast }) {
  if (!toast) return null;
  const tone = toast.type === 'error' ? t.danger : t.success;
  return (
    <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm"
      style={{ background: t.surface, border: `1px solid ${tone}`, color: t.text }}>
      <CheckCircle2 size={16} style={{ color: tone }} /> {toast.msg}
    </div>
  );
}

function StatCard({ t, label, value, sub, tone = 'steel', icon: Icon, trend }) {
  const toneColor = { steel: t.steel, accent: t.accent, success: t.success, warning: t.warning, danger: t.danger }[tone];
  return (
    <Card t={t} className="p-4">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: t.textFaint, letterSpacing: '0.04em' }}>{label}</span>
        <div className="p-1.5 rounded-md" style={{ background: `${toneColor}22` }}><Icon size={15} style={{ color: toneColor }} /></div>
      </div>
      <div className="mt-2 text-2xl font-semibold" style={{ color: t.text, fontFamily: "'Space Grotesk',sans-serif" }}>{value}</div>
      {sub && (
        <div className="mt-1 flex items-center gap-1 text-xs" style={{ color: trend === 'down' ? t.danger : t.success }}>
          {trend === 'down' ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />} {sub}
        </div>
      )}
    </Card>
  );
}

function LoginScreen({ t, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const { token, refreshToken, user } = await api.login(username, password);
      setTokens(token, refreshToken);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex items-center justify-center" style={{ minHeight: '600px', background: t.bg, fontFamily: "'Inter',sans-serif" }}>
      <div className="w-full max-w-sm p-8 rounded-xl" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center font-bold mx-auto mb-3" style={{ background: t.accent, color: '#fff', fontFamily: "'Space Grotesk',sans-serif" }}>RS</div>
          <div className="text-lg font-semibold" style={{ color: t.text, fontFamily: "'Space Grotesk',sans-serif" }}>ROPLANT SERVICE LTD</div>
          <div className="text-xs" style={{ color: t.textFaint }}>Sign in to the inventory & business system</div>
        </div>
        <div className="flex flex-col gap-3">
          <Field t={t} label="Username (name or email)"><TInput t={t} autoFocus value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="e.g. Ronald Mukasa" /></Field>
          <Field t={t} label="Password"><TInput t={t} type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="••••••••" /></Field>
          {error && <div className="text-xs px-3 py-2 rounded-md" style={{ background: t.dangerSoft, color: t.danger }}>{error}</div>}
          <Btn t={t} onClick={submit} variant="primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</Btn>
        </div>
      </div>
    </div>
  );
}

/* ============================== APP ============================== */
export default function App() {
  const [theme, setTheme] = useState('dark');
  const t = THEMES[theme];
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const role = currentUser?.role || null;
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [activeModule, setActiveModule] = useState('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const [companyInfo, setCompanyInfo] = useState({
    name: 'ROPLANT SERVICE LTD', tagline: 'For: Heavy Machines Spare Parts, Cat, Cummins Komatish, Perkins and Others',
    shopLocation: 'Shop No. 071, Second Floor, Original Shauriyako', poBox: 'P.O Box 137555', cityCountry: 'Kampala-Uganda',
    address: 'Shop No. 071, Second Floor, Original Shauriyako, Kampala-Uganda',
    phone: '+256 0772 916056', phone2: '+256 753 916056', email: 'mukasaronald2@gmail.com', currency: 'UGX',
    taxRate: 18, invoicePrefix: 'RPL-INV', receiptFooter: 'All accounts are due on demand', logo: '',
  });

  const [products, setProducts] = useState(initialProducts);
  const [customers, setCustomers] = useState(initialCustomers);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [users, setUsers] = useState(initialUsers);
  const [movements, setMovements] = useState(() =>
    initialProducts.map(p => ({ id: nextId(), productId: p.id, type: 'Opening Stock', qtyChange: p.stockQty, balanceAfter: p.stockQty, reference: 'OPEN-0001', user: 'System', date: '2026-01-01 00:00' }))
  );
  const [sales, setSales] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([
    { id: nextId(), poNo: 'PO-0001', supplierId: 1, supplierName: 'Massey Ferguson Parts (U) Ltd', date: '2026-08-20', items: [{ productId: 1, name: 'Cylinder Head Gasket', qty: 10, unitCost: 85000 }], total: 850000, status: 'Received', grnNo: 'GRN-0001' },
    { id: nextId(), poNo: 'PO-0002', supplierId: 3, supplierName: 'New Holland Distributors', date: '2026-09-01', items: [{ productId: 3, name: 'Oil Filter Cartridge', qty: 40, unitCost: 12000 }], total: 480000, status: 'Pending', grnNo: null },
    { id: nextId(), poNo: 'PO-0003', supplierId: 2, supplierName: 'John Deere East Africa', date: '2026-09-03', items: [{ productId: 7, name: 'Rear Tyre 18.4-34', qty: 5, unitCost: 780000 }], total: 3900000, status: 'Pending', grnNo: null },
  ]);
  const [returns, setReturns] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [auditLog, setAuditLog] = useState([
    { id: nextId(), date: '2026-09-05 08:14', user: 'Ronald Opio', role: 'Admin', action: 'Updated sell price', module: 'Products & Inventory', before: 'UGX 125,000', after: 'UGX 135,000' },
    { id: nextId(), date: '2026-09-04 16:22', user: 'Patience Auma', role: 'Inventory', action: 'Received PO-0001', module: 'Purchasing', before: 'Stock: 4', after: 'Stock: 14' },
    { id: nextId(), date: '2026-09-04 11:05', user: 'David Mugisha', role: 'Sales', action: 'Completed sale RPL-INV-0004', module: 'POS', before: '-', after: 'UGX 610,000' },
  ]);

  useEffect(() => {
    if (!getToken()) { setSessionChecked(true); return; }
    api.me()
      .then((data) => setCurrentUser(data.user))
      .catch(() => setTokens(null, null))
      .finally(() => setSessionChecked(true));
  }, []);

  // Real settings persistence (Phase 20): once logged in, load the actual backend row instead
  // of trusting the hardcoded defaults above — this is what makes Settings survive refresh,
  // logout/login, and a backend restart, not just the lifetime of this component.
  useEffect(() => {
    if (!currentUser) return;
    api.getSettings().then((data) => setCompanyInfo(settingsFromApi(data.settings))).catch(() => {});
  }, [currentUser]);

  const [productsLoading, setProductsLoading] = useState(true);
  const refetchProducts = () => {
    setProductsLoading(true);
    return api.listProducts({ pageSize: 200 })
      .then((data) => setProducts(data.products.map(productFromApi)))
      .catch((err) => notify(err.message, 'error'))
      .finally(() => setProductsLoading(false));
  };
  useEffect(() => {
    if (!currentUser) return;
    refetchProducts();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    api.listSales({ pageSize: 200 }).then((data) => setSales(data.sales.map(saleFromApi))).catch((err) => notify(err.message, 'error'));
  }, [currentUser]);

  useEffect(() => {
    if (role && !permissions[role]?.includes(activeModule)) setActiveModule('dashboard');
  }, [role]); // eslint-disable-line

  useEffect(() => {
    if (toast) { const tm = setTimeout(() => setToast(null), 3200); return () => clearTimeout(tm); }
  }, [toast]);

  if (!sessionChecked) return null; // avoid a flash of the login screen while restoring a session
  if (!currentUser) return <LoginScreen t={t} onLogin={setCurrentUser} />;

  const notify = (msg, type = 'success') => setToast({ msg, type });
  const logAudit = (entry) => setAuditLog(prev => [{ id: nextId(), date: nowStr(), user: currentUser.name, role, ...entry }, ...prev]);

  const addMovement = (productId, type, qtyChange, reference) => {
    setMovements(prev => {
      const product = products.find(p => p.id === productId);
      const balanceAfter = (product?.stockQty || 0) + qtyChange;
      return [{ id: nextId(), productId, type, qtyChange, balanceAfter, reference, user: currentUser.name, date: nowStr() }, ...prev];
    });
  };

  const visibleNav = NAV_ITEMS.filter(n => permissions[role]?.includes(n.id));

  const logout = () => {
    logAudit({ action: 'Logged out', module: 'Auth' });
    api.logout(getRefreshToken());
    setTokens(null, null);
    setCurrentUser(null);
    setActiveModule('dashboard');
  };

  const ctx = { t, theme, role, currentUser, companyInfo, notify, setConfirm, logAudit, addMovement, setActiveModule, permissions, setPermissions, users, setUsers };

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", background: t.bg, color: t.text, minHeight: '600px' }} className="w-full flex rounded-xl overflow-hidden">
      <style>{`${FONT_IMPORT} * { box-sizing: border-box; } ::-webkit-scrollbar{width:8px;height:8px;} ::-webkit-scrollbar-thumb{background:${t.border};border-radius:4px;}
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }`}</style>

      {/* SIDEBAR */}
      <aside className={`flex-col shrink-0 ${mobileNavOpen ? 'flex absolute z-40 h-full' : 'hidden'} md:flex md:static`}
        style={{ width: '236px', background: t.surface, borderRight: `1px solid ${t.border}` }}>
        <div className="px-5 py-5 flex items-center gap-2.5" style={{ borderBottom: `1px solid ${t.border}` }}>
          {companyInfo.logo
            ? <img src={companyInfo.logo} alt="Logo" className="w-9 h-9 rounded-md object-contain" style={{ background: '#fff' }} />
            : <div className="w-9 h-9 rounded-md flex items-center justify-center font-bold text-sm" style={{ background: t.accent, color: '#fff', fontFamily: "'Space Grotesk',sans-serif" }}>RS</div>}
          <div>
            <div className="text-sm font-semibold leading-tight" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Roplant Services</div>
            <div className="text-xs" style={{ color: t.textFaint }}>Inventory & Business System</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-1">
          {visibleNav.map(item => {
            const Icon = item.icon; const active = activeModule === item.id;
            return (
              <button key={item.id} onClick={() => { setActiveModule(item.id); setMobileNavOpen(false); }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium text-left"
                style={{ background: active ? t.accentSoft : 'transparent', color: active ? t.accent : t.textMuted }}>
                <Icon size={17} />{item.label}
              </button>
            );
          })}
          <button onClick={logout} className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium text-left mt-1"
            style={{ background: 'transparent', color: t.danger }}>
            <LogOut size={17} />Log Out
          </button>
        </nav>
        <div className="p-3 text-xs" style={{ color: t.textFaint, borderTop: `1px solid ${t.border}` }}>
          Signed in as {currentUser.name} ({role}{currentUser.isOwner ? ' · Owner' : ''})
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOPBAR */}
        <header className="flex items-center gap-3 px-4 md:px-6 py-3 shrink-0" style={{ borderBottom: `1px solid ${t.border}`, background: t.surface }}>
          <button className="md:hidden" onClick={() => setMobileNavOpen(v => !v)}><Menu size={20} /></button>
          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-md flex-1 max-w-sm" style={{ background: t.surfaceAlt, border: `1px solid ${t.border}` }}>
            <Search size={15} style={{ color: t.textFaint }} />
            <input placeholder="Search parts, customers, invoices…" className="bg-transparent outline-none text-sm w-full" style={{ color: t.text }} />
          </div>
          <div className="flex-1 md:hidden" />
          <div className="flex items-center gap-2">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-md" style={{ background: t.surfaceAlt, border: `1px solid ${t.border}` }}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <NotificationBell t={t} products={products} customers={customers} purchaseOrders={purchaseOrders} setActiveModule={setActiveModule} />
            <div className="hidden sm:flex items-center gap-2 pl-2" style={{ borderLeft: `1px solid ${t.border}` }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: t.steelSoft, color: t.steel }}>
                {currentUser.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div className="text-xs leading-tight">
                <div className="font-medium">{currentUser.name}</div>
                <div style={{ color: t.textFaint }}>{role}{currentUser.isOwner ? ' · Owner' : ''}</div>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6" style={{ background: t.bg }}>
          {activeModule === 'dashboard' && <Dashboard {...ctx} products={products} sales={sales} customers={customers} suppliers={suppliers} />}
          {activeModule === 'inventory' && <Inventory {...ctx} products={products} setProducts={setProducts} productsLoading={productsLoading} refetchProducts={refetchProducts} movements={movements} />}
          {activeModule === 'icc' && <InventoryControlCenter {...ctx} products={products} setProducts={setProducts} movements={movements} sales={sales} purchaseOrders={purchaseOrders} suppliers={suppliers} customers={customers} returns={returns} />}
          {activeModule === 'stockmgmt' && <StockManagement {...ctx} products={products} setProducts={setProducts} movements={movements} />}
          {activeModule === 'pos' && <POS {...ctx} products={products} setProducts={setProducts} refetchProducts={refetchProducts} customers={customers} setCustomers={setCustomers} sales={sales} setSales={setSales} />}
          {activeModule === 'documents' && <Documents {...ctx} sales={sales} customers={customers} products={products} quotations={quotations} setQuotations={setQuotations} />}
          {activeModule === 'whatsapp' && <WhatsAppModule {...ctx} customers={customers} sales={sales} />}
          {activeModule === 'purchasing' && <Purchasing {...ctx} suppliers={suppliers} setSuppliers={setSuppliers} products={products} setProducts={setProducts} purchaseOrders={purchaseOrders} setPurchaseOrders={setPurchaseOrders} />}
          {activeModule === 'customers' && <Customers {...ctx} customers={customers} setCustomers={setCustomers} sales={sales} setSales={setSales} />}
          {activeModule === 'suppliers' && <Suppliers {...ctx} suppliers={suppliers} setSuppliers={setSuppliers} purchaseOrders={purchaseOrders} />}
          {activeModule === 'returns' && <ReturnsModule {...ctx} products={products} setProducts={setProducts} sales={sales} customers={customers} setCustomers={setCustomers} suppliers={suppliers} setSuppliers={setSuppliers} returns={returns} setReturns={setReturns} />}
          {activeModule === 'reports' && <Reports {...ctx} products={products} sales={sales} purchaseOrders={purchaseOrders} customers={customers} suppliers={suppliers} movements={movements} returns={returns} />}
          {activeModule === 'users' && <UsersSecurity {...ctx} users={users} setUsers={setUsers} permissions={permissions} setPermissions={setPermissions} auditLog={auditLog} />}
          {activeModule === 'settings' && <SettingsPage {...ctx} companyInfo={companyInfo} setCompanyInfo={setCompanyInfo} />}
        </main>
      </div>

      <Toast t={t} toast={toast} />
      <ConfirmDialog t={t} data={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

/* ============================== DASHBOARD ============================== */
function Dashboard({ t, role, companyInfo, products, sales, customers, suppliers, setActiveModule }) {
  const FINANCE_ROLES = ['Admin', 'Manager', 'Accountant'];
  const canSeeFinancials = FINANCE_ROLES.includes(role);
  const canSeeStockValue = ['Admin', 'Manager', 'Accountant', 'Inventory'].includes(role);
  const inventoryValue = products.reduce((s, p) => s + p.stockQty * p.costPrice, 0);
  const lowStock = products.filter(p => p.stockQty > 0 && p.stockQty <= p.reorderLevel);
  const outOfStockCount = products.filter(p => p.stockQty === 0).length;
  const receivables = customers.reduce((s, c) => s + c.balance, 0);
  const payables = suppliers.reduce((s, sup) => s + sup.balance, 0);
  const monthRevenue = sales.reduce((s, x) => s + x.total, 0) + REVENUE_TREND[REVENUE_TREND.length - 1].revenue;
  const monthProfit = sales.reduce((s, x) => s + (x.total - x.items.reduce((a, i) => a + i.cost * i.qty, 0)), 0) + REVENUE_TREND[REVENUE_TREND.length - 1].profit;
  const categoryData = CATEGORIES.map(c => ({ name: c, value: products.filter(p => p.category === c).reduce((s, p) => s + p.stockQty * p.costPrice, 0) })).filter(d => d.value > 0);
  const pieColors = [t.accent, t.steel, t.success, t.warning, t.danger, '#8B7FD9', '#4FBFB0', '#C97FB0'];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Dashboard</h1>
        <p className="text-sm" style={{ color: t.textMuted }}>Overview for {companyInfo.name} — {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
      </div>

      <button onClick={() => setActiveModule('icc')} className="w-full text-left rounded-xl p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        style={{ background: `linear-gradient(135deg, ${t.accentSoft}, ${t.steelSoft})`, border: `1px solid ${t.accent}55` }}
        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.05)'} onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.accent }}>
            <Warehouse size={22} color="#fff" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Inventory Management</h2>
              <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded" style={{ background: t.successSoft, color: t.success }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.success }} /> Live
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: t.textMuted }}>
              Real-time stock position — {products.length} products{canSeeStockValue ? `, ${money(inventoryValue, companyInfo.currency)} in value` : ''}
              {(lowStock.length || outOfStockCount) ? `, ${lowStock.length} low stock, ${outOfStockCount} out of stock` : ', all levels healthy'}.
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-sm font-medium shrink-0" style={{ color: t.accent }}>Open Inventory Control Center <ArrowUpRight size={16} /></span>
      </button>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {canSeeFinancials ? (
          <>
            <StatCard t={t} label="Revenue (MTD)" value={money(monthRevenue, companyInfo.currency)} sub="12.4% vs last month" icon={TrendingUp} tone="accent" />
            <StatCard t={t} label="Gross Profit (MTD)" value={money(monthProfit, companyInfo.currency)} sub="8.9% vs last month" icon={Wallet} tone="success" />
          </>
        ) : (
          <>
            <StatCard t={t} label="Sales Today" value={sales.filter(s => s.date === todayStr()).length} sub="Transactions completed" icon={TrendingUp} tone="accent" />
            <StatCard t={t} label="Total Customers" value={customers.length} sub="On file" icon={Users} tone="success" />
          </>
        )}
        {canSeeStockValue ? (
          <StatCard t={t} label="Inventory Value" value={money(inventoryValue, companyInfo.currency)} sub={`${products.length} SKUs tracked`} icon={Package} tone="steel" trend="up" />
        ) : (
          <StatCard t={t} label="Products In Stock" value={products.filter(p => p.stockQty > 0).length} sub={`of ${products.length} total SKUs`} icon={Package} tone="steel" />
        )}
        <StatCard t={t} label="Low Stock Alerts" value={lowStock.length} sub={lowStock.length ? 'Needs reordering' : 'All stock healthy'} icon={AlertTriangle} tone={lowStock.length ? 'danger' : 'success'} trend={lowStock.length ? 'down' : 'up'} />
      </div>

      {canSeeFinancials && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard t={t} label="Receivables" value={money(receivables, companyInfo.currency)} sub={`${customers.filter(c => c.balance > 0).length} customers owing`} icon={ArrowUpRight} tone="warning" />
          <StatCard t={t} label="Payables" value={money(payables, companyInfo.currency)} sub={`${suppliers.filter(s => s.balance > 0).length} suppliers owed`} icon={ArrowDownRight} tone="danger" />
          <StatCard t={t} label="Total Products" value={products.length} sub={`${CATEGORIES.length} categories`} icon={ClipboardList} tone="steel" />
          <StatCard t={t} label="Total Customers" value={customers.length} sub={`${sales.length} sales this session`} icon={Users} tone="accent" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card t={t} className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Revenue & Profit Trend</h3>
            <Badge t={t} tone="steel">Last 6 months</Badge>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={REVENUE_TREND}>
              <CartesianGrid stroke={t.chartGrid} strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke={t.textFaint} fontSize={12} />
              <YAxis stroke={t.textFaint} fontSize={11} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
              <Tooltip contentStyle={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }} formatter={v => fmt(v)} />
              <Line type="monotone" dataKey="revenue" stroke={t.accent} strokeWidth={2.5} dot={false} name="Revenue" />
              <Line type="monotone" dataKey="profit" stroke={t.steel} strokeWidth={2.5} dot={false} name="Profit" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card t={t} className="p-4">
          <h3 className="font-semibold text-sm mb-3" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Stock Value by Category</h3>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {categoryData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }} formatter={v => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card t={t} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Stock Alerts</h3>
            <Badge t={t} tone="danger">{lowStock.length} items</Badge>
          </div>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {lowStock.length === 0 && <p className="text-sm" style={{ color: t.textFaint }}>No products below reorder level.</p>}
            {lowStock.map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-md" style={{ background: t.surfaceAlt }}>
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs" style={{ color: t.textFaint, fontFamily: "'JetBrains Mono',monospace" }}>{p.sku} · {p.location}</div>
                </div>
                <Badge t={t} tone="danger">{p.stockQty} / {p.reorderLevel}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card t={t} className="p-4">
          <h3 className="font-semibold text-sm mb-3" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Recent Sales</h3>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {sales.length === 0 && <p className="text-sm" style={{ color: t.textFaint }}>No sales recorded yet this session — try the POS module.</p>}
            {sales.slice(0, 6).map(s => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-md" style={{ background: t.surfaceAlt }}>
                <div>
                  <div className="text-sm font-medium">{s.customerName}</div>
                  <div className="text-xs" style={{ color: t.textFaint }}>{s.invoiceNo} · {s.date}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{money(s.total, companyInfo.currency)}</div>
                  <Badge t={t} tone={s.status === 'Paid' ? 'success' : 'warning'}>{s.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================== INVENTORY ============================== */
function Inventory({ t, products, setProducts, movements, companyInfo, notify, logAudit, addMovement, role }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [modal, setModal] = useState(null); // 'add' | product for edit
  const [historyProduct, setHistoryProduct] = useState(null);
  const canEdit = ['Admin', 'Manager', 'Inventory'].includes(role);

  const filtered = products.filter(p =>
    (category === 'All' || p.category === category) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()) || p.partNumber.toLowerCase().includes(search.toLowerCase()))
  );

  const saveProduct = async (data, isNew) => {
    if (!data.name || !data.category || !data.brand || data.sellPrice <= 0 || data.costPrice < 0 || data.stockQty < 0) {
      notify('Please complete all required fields with valid values.', 'error'); return;
    }
    try {
      if (isNew) {
        const skuNum = String(products.length + 1).padStart(4, '0');
        const prefix = data.category.slice(0, 3).toUpperCase();
        const { product } = await api.createProduct({ ...data, sku: `${prefix}-${skuNum}` });
        const mapped = productFromApi(product);
        setProducts(prev => [...prev, mapped]);
        logAudit({ action: `Created product ${mapped.name}`, module: 'Products & Inventory', before: '-', after: `Stock: ${mapped.stockQty}` });
        notify(`Product "${mapped.name}" added with SKU ${mapped.sku}.`);
      } else {
        const { product } = await api.updateProduct(data.id, { ...data, expectedUpdatedAt: data.updatedAt });
        const mapped = productFromApi(product);
        setProducts(prev => prev.map(p => p.id === mapped.id ? mapped : p));
        logAudit({ action: `Edited ${mapped.name}`, module: 'Products & Inventory', before: `Sell: ${companyInfo.currency} ${fmt(data.sellPrice)}`, after: `Sell: ${companyInfo.currency} ${fmt(mapped.sellPrice)}` });
        notify(`Product "${mapped.name}" updated.`);
      }
      setModal(null);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Products & Inventory</h1>
          <p className="text-sm" style={{ color: t.textMuted }}>{products.length} products · {money(products.reduce((s, p) => s + p.stockQty * p.costPrice, 0), companyInfo.currency)} stock value</p>
        </div>
        {canEdit && <Btn t={t} variant="primary" icon={Plus} onClick={() => setModal('add')}>Add Product</Btn>}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md flex-1 min-w-[220px]" style={{ background: t.surfaceAlt, border: `1px solid ${t.border}` }}>
          <Search size={15} style={{ color: t.textFaint }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, SKU or part number…" className="bg-transparent outline-none text-sm w-full" style={{ color: t.text }} />
        </div>
        <TSelect t={t} value={category} onChange={e => setCategory(e.target.value)} style={{ width: 200 }}>
          <option>All</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </TSelect>
      </div>

      <Card t={t} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
              {['Part', 'SKU / Part#', 'Category', 'Brand', 'Stock', 'Cost', 'Sell Price', 'Value', 'Location', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const low = p.stockQty <= p.reorderLevel;
              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <ProductThumb t={t} product={p} size={36} />
                      <div><div className="font-medium">{p.name}</div><div className="text-xs" style={{ color: t.textFaint }}>{p.compatibility}</div></div>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5 }}>{p.sku}<br /><span style={{ color: t.textFaint }}>{p.partNumber}</span></td>
                  <td className="px-4 py-3">{p.category}</td>
                  <td className="px-4 py-3">{p.brand}</td>
                  <td className="px-4 py-3"><Badge t={t} tone={low ? 'danger' : 'success'}>{p.stockQty} units</Badge></td>
                  <td className="px-4 py-3">{fmt(p.costPrice)}</td>
                  <td className="px-4 py-3 font-medium">{fmt(p.sellPrice)}</td>
                  <td className="px-4 py-3">{fmt(p.stockQty * p.costPrice)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: t.textMuted }}>{p.location}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button title="Stock history" onClick={() => setHistoryProduct(p)}><History size={15} style={{ color: t.textFaint }} /></button>
                      {canEdit && <button title="Edit" onClick={() => setModal(p)}><Pencil size={15} style={{ color: t.textFaint }} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-sm" style={{ color: t.textFaint }}>No products match your search.</td></tr>}
          </tbody>
        </table>
      </Card>

      {modal && (
        <ProductModal t={t} initial={modal === 'add' ? null : modal} onClose={() => setModal(null)} onSave={saveProduct} isNew={modal === 'add'} />
      )}

      {historyProduct && (
        <Modal t={t} title={`Stock Movement — ${historyProduct.name}`} onClose={() => setHistoryProduct(null)} wide>
          <div className="flex items-center gap-3 mb-4 text-xs" style={{ color: t.textFaint }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{historyProduct.sku}</span> · Current stock: <Badge t={t} tone="steel">{historyProduct.stockQty} units</Badge>
          </div>
          <div className="overflow-y-auto max-h-96">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{['Date', 'Type', 'Qty Change', 'Balance After', 'Reference', 'User'].map(h => <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>)}</tr></thead>
              <tbody>
                {movements.filter(m => m.productId === historyProduct.id).map(m => (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td className="px-3 py-2 text-xs">{m.date}</td>
                    <td className="px-3 py-2"><Badge t={t} tone={m.qtyChange >= 0 ? 'success' : 'danger'}>{m.type}</Badge></td>
                    <td className="px-3 py-2" style={{ color: m.qtyChange >= 0 ? t.success : t.danger }}>{m.qtyChange >= 0 ? '+' : ''}{m.qtyChange}</td>
                    <td className="px-3 py-2">{m.balanceAfter}</td>
                    <td className="px-3 py-2 text-xs" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{m.reference}</td>
                    <td className="px-3 py-2 text-xs">{m.user}</td>
                  </tr>
                ))}
                {movements.filter(m => m.productId === historyProduct.id).length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm" style={{ color: t.textFaint }}>No movements recorded.</td></tr>}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ProductModal({ t, initial, onClose, onSave, isNew }) {
  const [form, setForm] = useState(initial || {
    name: '', category: CATEGORIES[0], brand: BRANDS[0], compatibility: '', costPrice: 0, sellPrice: 0, stockQty: 0, reorderLevel: 5, maxStock: 30, location: LOCATIONS[0], partNumber: '', image: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <Modal t={t} title={isNew ? 'Add Product' : `Edit — ${form.name}`} onClose={onClose} wide
      footer={<>
        <Btn t={t} variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn t={t} variant="primary" onClick={() => onSave(form, isNew)}>{isNew ? 'Add Product' : 'Save Changes'}</Btn>
      </>}>
      <div className="flex items-center gap-4 mb-5 p-3 rounded-md" style={{ background: t.surfaceAlt }}>
        <ProductThumb t={t} product={form} size={80} rounded="rounded-lg" />
        <div className="flex-1 flex flex-col gap-2 min-w-[200px]">
          <div className="text-sm font-medium" style={{ color: t.text }}>Product Photo <span className="font-normal" style={{ color: t.textFaint }}>(optional)</span></div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer" style={{ background: t.accent, color: '#fff' }}>
              Upload from device
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => set('image', reader.result);
                reader.readAsDataURL(file);
              }} />
            </label>
            {form.image && <button type="button" onClick={() => set('image', '')} className="text-xs underline" style={{ color: t.textFaint }}>Clear</button>}
          </div>
          <TInput t={t} value={form.image} onChange={e => set('image', e.target.value)} placeholder="…or paste an image URL" />
          <p className="text-xs" style={{ color: t.textFaint }}>No photo needed — products without one get an automatic category icon instead.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field t={t} label="Product Name *"><TInput t={t} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Cylinder Head Gasket" /></Field>
        <Field t={t} label="Manufacturer Part Number"><TInput t={t} value={form.partNumber} onChange={e => set('partNumber', e.target.value)} placeholder="e.g. MF-3610245" /></Field>
        <Field t={t} label="Category *"><TSelect t={t} value={form.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</TSelect></Field>
        <Field t={t} label="Brand *"><TSelect t={t} value={form.brand} onChange={e => set('brand', e.target.value)}>{BRANDS.map(b => <option key={b}>{b}</option>)}</TSelect></Field>
        <Field t={t} label="Compatibility"><TInput t={t} value={form.compatibility} onChange={e => set('compatibility', e.target.value)} placeholder="e.g. MF 240, MF 375" /></Field>
        <Field t={t} label="Storage Location"><TSelect t={t} value={form.location} onChange={e => set('location', e.target.value)}>{LOCATIONS.map(l => <option key={l}>{l}</option>)}</TSelect></Field>
        <Field t={t} label="Cost Price *"><TInput t={t} type="number" value={form.costPrice} onChange={e => set('costPrice', +e.target.value)} /></Field>
        <Field t={t} label="Sell Price *"><TInput t={t} type="number" value={form.sellPrice} onChange={e => set('sellPrice', +e.target.value)} /></Field>
        <Field t={t} label={isNew ? 'Opening Stock Qty *' : 'Current Stock (view stock movements to adjust)'}><TInput t={t} type="number" disabled={!isNew} value={form.stockQty} onChange={e => set('stockQty', +e.target.value)} /></Field>
        <Field t={t} label="Reorder Level (Min Stock) *"><TInput t={t} type="number" value={form.reorderLevel} onChange={e => set('reorderLevel', +e.target.value)} /></Field>
        <Field t={t} label="Maximum Stock *"><TInput t={t} type="number" value={form.maxStock} onChange={e => set('maxStock', +e.target.value)} /></Field>
      </div>
      <div className="mt-4 p-3 rounded-md flex items-center gap-2 text-xs" style={{ background: t.surfaceAlt, color: t.textMuted }}>
        <QrCode size={15} /> Barcode & QR code will be auto-generated on save and are printable from the product list.
      </div>
    </Modal>
  );
}

/* ============================== POS ============================== */
function POS({ t, products, setProducts, refetchProducts, customers, setCustomers, sales, setSales, companyInfo, notify, logAudit, addMovement, role }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState(customers[0]?.id);
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState('Cash');
  const [receipt, setReceipt] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);

  // Starts from the FULL product list — every item in inventory is browsable here, active
  // or out of stock alike (out-of-stock items still show, just dimmed and unclickable).
  const filtered = products.filter(p =>
    (categoryFilter === 'All' || p.category === categoryFilter) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
  );
  const addToCart = (p) => {
    if (p.stockQty <= 0) { notify(`${p.name} is out of stock.`, 'error'); return; }
    setCart(prev => {
      const existing = prev.find(i => i.productId === p.id);
      if (existing) {
        if (existing.qty >= p.stockQty) { notify('Not enough stock available.', 'error'); return prev; }
        return prev.map(i => i.productId === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { productId: p.id, sku: p.sku, name: p.name, price: p.sellPrice, cost: p.costPrice, qty: 1, maxQty: p.stockQty }];
    });
  };
  const findByCode = (code) => products.find(p => p.barcode === code.trim() || p.sku.toLowerCase() === code.trim().toLowerCase());
  const changeQty = (id, delta) => setCart(prev => prev.map(i => i.productId === id ? { ...i, qty: Math.max(1, Math.min(i.maxQty, i.qty + delta)) } : i));
  const removeItem = (id) => setCart(prev => prev.filter(i => i.productId !== id));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmt = subtotal * (discount / 100);
  const taxable = subtotal - discountAmt;
  const tax = taxable * (companyInfo.taxRate / 100);
  const total = taxable + tax;

  const [checkingOut, setCheckingOut] = useState(false);
  const completeSale = async () => {
    if (cart.length === 0) { notify('Cart is empty.', 'error'); return; }
    const customer = customers.find(c => c.id === customerId);
    setCheckingOut(true);
    try {
      const { sale } = await api.createSale({
        customerId,
        items: cart.map(i => ({ productId: i.productId, qty: i.qty })),
        discountPct: discount,
        paymentMethod: payment,
      });
      // The backend is authoritative for prices/totals — it recomputes everything from the
      // real DB rather than trusting whatever the cart said, so the receipt uses its numbers,
      // not the locally-estimated ones the cart was showing a moment ago.
      const receiptData = {
        id: sale.id, invoiceNo: sale.invoice_no, date: (sale.created_at || '').slice(0, 10) || todayStr(),
        customerId, customerName: sale.customerName || customer.name,
        items: cart.map(i => ({ productId: i.productId, sku: i.sku, name: i.name, price: i.price, qty: i.qty })),
        subtotal: Number(sale.subtotal), discount: Number(sale.discount), tax: Number(sale.tax), total: Number(sale.total),
        paymentMethod: sale.payment_method, status: sale.status, servedBy: sale.servedBy,
      };
      setSales(prev => [receiptData, ...prev]);
      await refetchProducts(); // stock was deducted server-side; reload real quantities rather than guessing locally
      logAudit({ action: `Completed sale ${sale.invoice_no}`, module: 'POS', before: '-', after: money(Number(sale.total), companyInfo.currency) });
      notify(`Sale ${sale.invoice_no} completed successfully.`);
      setReceipt(receiptData);
      setCart([]); setDiscount(0); setPayment('Cash');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Sales / POS</h1>
        <p className="text-sm" style={{ color: t.textMuted }}>Search or scan a part to start a sale.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md flex-1 min-w-[160px]" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <Search size={15} style={{ color: t.textFaint }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search or scan barcode…" className="bg-transparent outline-none text-sm w-full" style={{ color: t.text }} />
            </div>
            <TSelect t={t} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ width: 170 }}>
              <option>All</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </TSelect>
            <Btn t={t} variant="secondary" icon={Camera} onClick={() => setScanOpen(true)}>Scan</Btn>
          </div>
          <p className="text-xs" style={{ color: t.textFaint }}>Showing {filtered.length} of {products.length} products{categoryFilter !== 'All' ? ` in ${categoryFilter}` : ''}.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-1">
            {filtered.map(p => (
              <Card key={p.id} t={t} className="p-3 cursor-pointer" style={{ opacity: p.stockQty <= 0 ? 0.5 : 1 }}>
                <div onClick={() => addToCart(p)}>
                  <div className="w-full aspect-square rounded-md overflow-hidden mb-2" style={{ background: t.surfaceAlt }}>
                    <ProductThumb t={t} product={p} size="100%" rounded="" />
                  </div>
                  <div className="text-sm font-medium leading-tight">{p.name}</div>
                  <div className="text-xs mb-1" style={{ color: t.textFaint, fontFamily: "'JetBrains Mono',monospace" }}>{p.sku}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{fmt(p.sellPrice)}</span>
                    <Badge t={t} tone={p.stockQty <= p.reorderLevel ? 'danger' : 'success'}>{p.stockQty} left</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card t={t} className="p-4 flex flex-col gap-3 h-fit sticky top-0">
          <h3 className="font-semibold text-sm" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Cart ({cart.length})</h3>
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
            {cart.length === 0 && <p className="text-sm" style={{ color: t.textFaint }}>No items yet — click a product to add it.</p>}
            {cart.map(i => (
              <div key={i.productId} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <ProductThumb t={t} product={products.find(p => p.id === i.productId)} size={30} />
                  <div className="min-w-0"><div className="font-medium truncate">{i.name}</div><div className="text-xs" style={{ color: t.textFaint }}>{fmt(i.price)} each</div></div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => changeQty(i.productId, -1)} className="p-1 rounded" style={{ background: t.surfaceAlt }}><Minus size={12} /></button>
                  <span className="w-5 text-center">{i.qty}</span>
                  <button onClick={() => changeQty(i.productId, 1)} className="p-1 rounded" style={{ background: t.surfaceAlt }}><Plus size={12} /></button>
                  <button onClick={() => removeItem(i.productId)}><X size={14} style={{ color: t.danger }} /></button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${t.border}` }} className="pt-3 flex flex-col gap-2">
            <Field t={t} label="Customer"><TSelect t={t} value={customerId} onChange={e => setCustomerId(+e.target.value)}>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</TSelect></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field t={t} label="Discount %"><TInput t={t} type="number" value={discount} onChange={e => setDiscount(+e.target.value)} /></Field>
              <Field t={t} label="Payment"><TSelect t={t} value={payment} onChange={e => setPayment(e.target.value)}><option>Cash</option><option>Card</option><option>Mobile Money</option><option>Credit</option></TSelect></Field>
            </div>
          </div>
          <div className="text-sm flex flex-col gap-1" style={{ borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
            <div className="flex justify-between"><span style={{ color: t.textMuted }}>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="flex justify-between"><span style={{ color: t.textMuted }}>Discount</span><span>-{fmt(discountAmt)}</span></div>
            <div className="flex justify-between"><span style={{ color: t.textMuted }}>Tax ({companyInfo.taxRate}%)</span><span>{fmt(tax)}</span></div>
            <div className="flex justify-between font-semibold text-base pt-1"><span>Total</span><span>{fmt(total)} {companyInfo.currency}</span></div>
          </div>
          <Btn t={t} variant="primary" onClick={completeSale} disabled={checkingOut}>{checkingOut ? 'Processing…' : 'Complete Sale'}</Btn>
        </Card>
      </div>

      {receipt && (
        <Modal t={t} title="Sale Complete" onClose={() => setReceipt(null)} wide
          footer={<>
            <Btn t={t} variant="secondary" icon={Download} onClick={() => downloadPdf(`${receipt.invoiceNo}.pdf`, {
              companyInfo, docTitle: 'INVOICE', docNo: receipt.invoiceNo, date: receipt.date,
              customerLines: [`M/s: ${receipt.customerName}`, `Payment: ${receipt.paymentMethod} (${receipt.status})`],
              items: receipt.items.map(i => ({ qty: i.qty, particulars: `${i.name} (${i.sku})`, rate: i.price, amount: i.price * i.qty })),
              subtotal: receipt.subtotal - receipt.discount, vat: receipt.tax, total: receipt.total, footer: companyInfo.receiptFooter,
            })}>PDF</Btn>
            <Btn t={t} variant="primary" icon={Printer} onClick={() => window.print()}>Print</Btn>
          </>}>
          <InvoicePrintable sale={receipt} companyInfo={companyInfo} />
        </Modal>
      )}

      {scanOpen && <ScanModal t={t} onClose={() => setScanOpen(false)} onConfirm={(p) => { addToCart(p); notify(`${p.name} verified and added to cart.`); setScanOpen(false); }} findByCode={findByCode} products={products} />}
    </div>
  );
}

function ScanModal({ t, onClose, onConfirm, findByCode, products }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectIntervalRef = useRef(null);
  const [code, setCode] = useState('');
  const [cameraError, setCameraError] = useState(null);
  const [matched, setMatched] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [liveDecoding, setLiveDecoding] = useState(false);
  const decodeSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const submit = (rawCode) => {
    const value = rawCode ?? code;
    if (!value.trim()) return;
    const product = findByCode(value);
    if (!product) { setNotFound(true); setMatched(null); return; }
    setNotFound(false);
    setCode(value);
    setMatched(product);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) { stream.getTracks().forEach(tr => tr.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        // Real live decoding — only runs where the browser actually supports it
        // (Chrome/Edge on desktop and Android as of this writing; not Safari/Firefox).
        if (decodeSupported) {
          try {
            const detector = new window.BarcodeDetector({
              formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
            });
            setLiveDecoding(true);
            detectIntervalRef.current = setInterval(async () => {
              if (!videoRef.current || videoRef.current.readyState < 2) return;
              try {
                const codes = await detector.detect(videoRef.current);
                if (codes.length > 0 && codes[0].rawValue) {
                  clearInterval(detectIntervalRef.current);
                  submit(codes[0].rawValue);
                }
              } catch { /* transient per-frame decode failure — just try again next tick */ }
            }, 400);
          } catch {
            setLiveDecoding(false); // BarcodeDetector listed but construction failed — fall back silently
          }
        }
      } catch (err) {
        setCameraError('Camera not available in this browser/context — use the barcode field below (works with USB/Bluetooth scanners too).');
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(tr => tr.stop());
      if (detectIntervalRef.current) clearInterval(detectIntervalRef.current);
    };
  }, []); // eslint-disable-line

  if (matched) {
    return (
      <Modal t={t} title="Verify Before Adding" onClose={onClose}
        footer={<>
          <Btn t={t} variant="secondary" onClick={() => { setMatched(null); setCode(''); }}>Not this item — rescan</Btn>
          <Btn t={t} variant="primary" onClick={() => onConfirm(matched)}>Confirm & Add to Cart</Btn>
        </>}>
        <p className="text-xs mb-3" style={{ color: t.textMuted }}>Confirm this is the correct item before it's added to the sale.</p>
        <div className="flex items-center gap-4 p-3 rounded-md" style={{ background: t.surfaceAlt }}>
          <ProductThumb t={t} product={matched} size={72} rounded="rounded-lg" />
          <div>
            <div className="font-semibold">{matched.name}</div>
            <div className="text-xs" style={{ color: t.textFaint, fontFamily: "'JetBrains Mono',monospace" }}>{matched.sku} · {matched.partNumber}</div>
            <div className="text-sm font-medium mt-1">{fmt(matched.sellPrice)}</div>
            <Badge t={t} tone={matched.stockQty <= matched.reorderLevel ? 'danger' : 'success'}>{matched.stockQty} in stock</Badge>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal t={t} title="Scan Product Barcode" onClose={onClose}>
      <div className="rounded-md overflow-hidden mb-3 flex items-center justify-center relative" style={{ background: '#000', aspectRatio: '4/3' }}>
        {cameraError
          ? <p className="text-xs text-center p-4" style={{ color: '#9AA5AD' }}>{cameraError}</p>
          : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />}
        {liveDecoding && !cameraError && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1" style={{ background: 'rgba(79,174,116,0.9)', color: '#fff' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#fff' }} /> Live scanning
          </span>
        )}
      </div>
      {!cameraError && !decodeSupported && (
        <p className="text-xs mb-2" style={{ color: t.warning }}>This browser doesn't support live barcode decoding (works in Chrome/Edge on desktop and Android). Type or scan the code below instead.</p>
      )}
      <p className="text-xs mb-2" style={{ color: t.textMuted }}>{liveDecoding ? 'Point the camera at a barcode — it will be detected automatically. Or type/scan below.' : 'Type or scan the code below — a handheld or Bluetooth scanner works here too.'}</p>
      <div className="flex gap-2">
        <TInput t={t} autoFocus value={code} onChange={e => { setCode(e.target.value); setNotFound(false); }} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="Barcode or SKU…" />
        <Btn t={t} variant="primary" onClick={() => submit()}>Find</Btn>
      </div>
      {notFound && <p className="text-xs mt-2" style={{ color: t.danger }}>No product matches "{code}". Check the code and try again.</p>}
      <div className="mt-4">
        <p className="text-xs mb-1.5" style={{ color: t.textFaint }}>Try a sample barcode:</p>
        <div className="flex flex-wrap gap-1.5">
          {products.slice(0, 5).map(p => (
            <button key={p.id} onClick={() => setCode(p.barcode)} className="text-xs px-2 py-1 rounded" style={{ background: t.surfaceAlt, color: t.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{p.barcode}</button>
          ))}
        </div>
      </div>
    </Modal>
  );
}


/* ============================== DOCUMENTS (QUOTATIONS & INVOICES) ============================== */
/**
 * Uses WhatsApp's official "click to chat" link (wa.me) — this is real and works with zero
 * setup or API credentials: it opens WhatsApp (app or web) with the message pre-typed into
 * the chat with that customer, and a person still taps Send themselves. It is NOT the same
 * as WhatsApp's paid Business API, which is what would be needed to send automatically from
 * the server with no human involved, or to attach a file (PDF) directly — click-to-chat is
 * text-only. See the note in the UI for exactly what that means in practice.
 */
function buildWhatsAppLink(phone, message) {
  const digits = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function WhatsAppModule({ t, customers, sales, companyInfo, notify, logAudit }) {
  const [customerId, setCustomerId] = useState(customers[0]?.id);
  const [messageType, setMessageType] = useState('statement');
  const [invoiceId, setInvoiceId] = useState('');
  const [customText, setCustomText] = useState('');

  const customer = customers.find(c => c.id === customerId);
  const customerSales = sales.filter(s => s.customerId === customerId);
  const selectedSale = customerSales.find(s => s.id === +invoiceId);

  const buildMessage = () => {
    if (!customer) return '';
    if (messageType === 'custom') return customText;
    if (messageType === 'invoice') {
      if (!selectedSale) return '';
      return `Hello ${customer.name}, here is your invoice from ${companyInfo.name}.\n\nInvoice: ${selectedSale.invoiceNo}\nDate: ${selectedSale.date}\nTotal: ${money(selectedSale.total, companyInfo.currency)}\nStatus: ${selectedSale.status}\n\n${companyInfo.receiptFooter}`;
    }
    return `Hello ${customer.name}, this is a balance update from ${companyInfo.name}.\n\nCurrent balance: ${money(customer.balance, companyInfo.currency)}${customer.creditLimit ? `\nCredit limit: ${money(customer.creditLimit, companyInfo.currency)}` : ''}\n\nPlease reach out if you have any questions — thank you for your business.`;
  };

  const message = buildMessage();

  const send = () => {
    if (!customer?.phone) { notify('This customer has no phone number on file.', 'error'); return; }
    if (!message.trim()) { notify('Nothing to send yet.', 'error'); return; }
    window.open(buildWhatsAppLink(customer.phone, message), '_blank');
    logAudit({ action: `Opened WhatsApp to ${customer.name} (${messageType})`, module: 'WhatsApp', after: messageType === 'invoice' ? selectedSale?.invoiceNo : messageType });
    notify(`WhatsApp opened for ${customer.name} — review the message and tap Send.`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>WhatsApp</h1>
        <p className="text-sm" style={{ color: t.textMuted }}>Send invoices, balances, and messages straight to a customer's WhatsApp.</p>
      </div>

      <Card t={t} className="p-4 flex flex-col gap-3 max-w-xl">
        <Field t={t} label="Customer">
          <TSelect t={t} value={customerId} onChange={e => { setCustomerId(+e.target.value); setInvoiceId(''); }}>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? '' : ' (no phone on file)'}</option>)}
          </TSelect>
        </Field>
        {customer && (
          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-md" style={{ background: t.surfaceAlt }}>
            <span style={{ color: t.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{customer.phone || 'No phone number'}</span>
            <Badge t={t} tone={customer.balance > 0 ? 'warning' : 'success'}>Balance: {fmt(customer.balance)}</Badge>
          </div>
        )}

        <Field t={t} label="Message Type">
          <TSelect t={t} value={messageType} onChange={e => setMessageType(e.target.value)}>
            <option value="statement">Balance / Statement Summary</option>
            <option value="invoice">Specific Invoice</option>
            <option value="custom">Custom Message</option>
          </TSelect>
        </Field>

        {messageType === 'invoice' && (
          <Field t={t} label="Invoice">
            <TSelect t={t} value={invoiceId} onChange={e => setInvoiceId(e.target.value)}>
              <option value="">Select an invoice…</option>
              {customerSales.map(s => <option key={s.id} value={s.id}>{s.invoiceNo} — {fmt(s.total)} ({s.status})</option>)}
            </TSelect>
            {customerSales.length === 0 && <p className="text-xs mt-1" style={{ color: t.textFaint }}>This customer has no invoices yet.</p>}
          </Field>
        )}

        {messageType === 'custom' && (
          <Field t={t} label="Message">
            <textarea value={customText} onChange={e => setCustomText(e.target.value)} rows={4}
              className="w-full px-3 py-2 rounded-md text-sm outline-none" style={inputStyle(t)} placeholder="Type a message…" />
          </Field>
        )}

        <div>
          <p className="text-xs mb-1" style={{ color: t.textFaint }}>Preview</p>
          <div className="p-3 rounded-md text-sm whitespace-pre-wrap" style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, minHeight: 60, color: t.text }}>
            {message || <span style={{ color: t.textFaint }}>Nothing to preview yet.</span>}
          </div>
        </div>

        <Btn t={t} variant="primary" icon={Send} onClick={send} disabled={!customer?.phone || !message.trim()}>Open in WhatsApp</Btn>

        <div className="text-xs p-3 rounded-md" style={{ background: t.warningSoft, color: t.warning }}>
          This opens WhatsApp with the message ready to go — a person still taps Send. To share an
          invoice PDF, download it first from Quotations & Invoices, then attach that file inside
          the WhatsApp chat once it opens. Sending automatically with no one involved, or attaching
          a file directly from here, needs WhatsApp's paid Business API (a Meta-verified business
          account and access token) — that's a backend integration for later, not something a free
          link can do.
        </div>
      </Card>
    </div>
  );
}

function Documents({ t, sales, customers, products, quotations, setQuotations, companyInfo, notify, logAudit, role }) {
  const [tab, setTab] = useState('quotations');
  const [modal, setModal] = useState(false);
  const [viewQuote, setViewQuote] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const nextDocNo = 3728 + quotations.length + 1;

  const createQuotation = (q) => {
    const newQuote = { ...q, id: nextId(), docNo: nextDocNo, date: todayStr(), createdBy: role };
    setQuotations(prev => [newQuote, ...prev]);
    logAudit({ action: `Created quotation #${nextDocNo} for ${q.customerName}`, module: 'Documents', before: '-', after: `${money(q.total, companyInfo.currency)}` });
    notify(`Quotation #${nextDocNo} created.`);
    setModal(false);
    setViewQuote(newQuote); // show the finished letterhead immediately, ready to print
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Quotations & Invoices</h1>
          <p className="text-sm" style={{ color: t.textMuted }}>Create proforma quotations and print or reprint any invoice — use "Print" then "Save as PDF" in the print dialog for a PDF copy.</p>
        </div>
        {tab === 'quotations' && <Btn t={t} variant="primary" icon={Plus} onClick={() => setModal(true)}>New Quotation</Btn>}
      </div>

      <div className="flex gap-2">
        {[{ id: 'quotations', label: 'Quotations (Proforma)' }, { id: 'invoices', label: 'Invoices (Sales Receipts)' }].map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} className="px-4 py-2 rounded-md text-sm font-medium"
            style={{ background: tab === tb.id ? t.accentSoft : t.surface, border: `1px solid ${tab === tb.id ? t.accent : t.border}`, color: tab === tb.id ? t.accent : t.textMuted }}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'quotations' && (
        <Card t={t} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{['Doc No', 'Date', 'Customer', 'Deliver To', 'Total', 'Expiry', ''].map(h => <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>)}</tr></thead>
            <tbody>
              {quotations.map(q => (
                <tr key={q.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td className="px-4 py-3" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{q.docNo}</td>
                  <td className="px-4 py-3 text-xs">{q.date}</td>
                  <td className="px-4 py-3">{q.customerName}</td>
                  <td className="px-4 py-3 text-xs">{q.deliverTo}</td>
                  <td className="px-4 py-3">{fmt(q.total)}</td>
                  <td className="px-4 py-3 text-xs">{q.expiry}</td>
                  <td className="px-4 py-3"><Btn t={t} variant="secondary" icon={Printer} onClick={() => setViewQuote(q)}>View / Print</Btn></td>
                </tr>
              ))}
              {quotations.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: t.textFaint }}>No quotations yet — create one to send a proforma to a customer.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'invoices' && (
        <Card t={t} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{['Invoice No', 'Date', 'Customer', 'Total', 'Payment', 'Status', ''].map(h => <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>)}</tr></thead>
            <tbody>
              {sales.map(s => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td className="px-4 py-3" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{s.invoiceNo}</td>
                  <td className="px-4 py-3 text-xs">{s.date}</td>
                  <td className="px-4 py-3">{s.customerName}</td>
                  <td className="px-4 py-3">{fmt(s.total)}</td>
                  <td className="px-4 py-3 text-xs">{s.paymentMethod}</td>
                  <td className="px-4 py-3"><Badge t={t} tone={s.status === 'Paid' ? 'success' : 'warning'}>{s.status}</Badge></td>
                  <td className="px-4 py-3"><Btn t={t} variant="secondary" icon={Printer} onClick={() => setViewInvoice(s)}>View / Print</Btn></td>
                </tr>
              ))}
              {sales.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: t.textFaint }}>No sales recorded yet — completed POS sales will appear here for reprinting anytime.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {modal && <QuotationComposer t={t} customers={customers} products={products} companyInfo={companyInfo} nextDocNo={nextDocNo} onClose={() => setModal(false)} onSave={createQuotation} notify={notify} />}

      {viewQuote && (
        <Modal t={t} title={`Quotation #${viewQuote.docNo}`} onClose={() => setViewQuote(null)} wide
          footer={<>
            <Btn t={t} variant="secondary" icon={Download} onClick={() => downloadPdf(`quotation-${viewQuote.docNo}.pdf`, {
              companyInfo, docTitle: 'PROFORMA/INVOICE', docNo: viewQuote.docNo, date: viewQuote.date,
              customerLines: [`M/s: ${viewQuote.customerName}`, viewQuote.deliverTo ? `Deliver To: ${viewQuote.deliverTo}` : null].filter(Boolean),
              items: viewQuote.items.map(i => ({ qty: i.qty, particulars: i.description, rate: i.unitPrice * (1 - i.discPct / 100), amount: i.qty * i.unitPrice * (1 - i.discPct / 100) })),
              subtotal: viewQuote.subtotal, vat: viewQuote.tax, total: viewQuote.total, footer: 'All accounts are due on demand',
            })}>PDF</Btn>
            <Btn t={t} variant="primary" icon={Printer} onClick={() => window.print()}>Print</Btn>
          </>}>
          <QuotationPrintable quote={viewQuote} companyInfo={companyInfo} />
        </Modal>
      )}

      {viewInvoice && (
        <Modal t={t} title={`Invoice ${viewInvoice.invoiceNo}`} onClose={() => setViewInvoice(null)} wide
          footer={<>
            <Btn t={t} variant="secondary" icon={Download} onClick={() => downloadPdf(`${viewInvoice.invoiceNo}.pdf`, {
              companyInfo, docTitle: 'INVOICE', docNo: viewInvoice.invoiceNo, date: viewInvoice.date,
              customerLines: [`M/s: ${viewInvoice.customerName}`, `Payment: ${viewInvoice.paymentMethod} (${viewInvoice.status})`],
              items: viewInvoice.items.map(i => ({ qty: i.qty, particulars: `${i.name} (${i.sku})`, rate: i.price, amount: i.price * i.qty })),
              subtotal: viewInvoice.subtotal - viewInvoice.discount, vat: viewInvoice.tax, total: viewInvoice.total, footer: companyInfo.receiptFooter,
            })}>PDF</Btn>
            <Btn t={t} variant="primary" icon={Printer} onClick={() => window.print()}>Print</Btn>
          </>}>
          <InvoicePrintable sale={viewInvoice} companyInfo={companyInfo} />
        </Modal>
      )}
    </div>
  );
}

/**
 * The actual letterhead, made editable — this is deliberately the SAME visual layout as
 * ProformaDocument (the printed version), so what you build here is exactly what prints.
 * Uses companyInfo.taxRate (not a hardcoded rate) so VAT always matches Settings.
 */
function QuotationComposer({ t, customers, products, companyInfo, nextDocNo, onClose, onSave, notify }) {
  const [customerName, setCustomerName] = useState('');
  const [deliverTo, setDeliverTo] = useState('');
  const [yourReference, setYourReference] = useState('');
  const [expiry, setExpiry] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); });
  const [taxExempt, setTaxExempt] = useState(false);
  const [items, setItems] = useState([{ description: '', qty: 1, unitPrice: 0 }]);

  const addLine = () => setItems(prev => [...prev, { description: '', qty: 1, unitPrice: 0 }]);
  const updateLine = (idx, patch) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeLine = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
  const tax = taxExempt ? 0 : subtotal * (companyInfo.taxRate / 100);
  const total = subtotal + tax;
  const cell = { border: '1px solid #000', padding: '5px 8px', textAlign: 'center' };
  const lineInput = { width: '100%', border: 'none', borderBottom: '1px dotted #999', outline: 'none', fontFamily: 'inherit', fontSize: 12, background: 'transparent' };

  const save = () => {
    if (!customerName.trim()) { notify('Enter a customer or organisation name.', 'error'); return; }
    if (items.length === 0 || items.some(i => !i.description.trim() || !i.qty || i.qty <= 0 || i.unitPrice < 0)) {
      notify('Every line item needs a description, a positive quantity, and a valid rate.', 'error'); return;
    }
    onSave({
      customerName, deliverTo, yourReference, expiry, taxExempt: taxExempt ? 'Y' : 'N', account: 'N/A',
      items: items.map(i => ({ code: 'TECH', description: i.description, qty: Number(i.qty), unitPrice: Number(i.unitPrice), discPct: 0 })),
      subtotal, tax, total,
    });
  };

  return (
    <Modal t={t} title="New Quotation / Proforma" onClose={onClose} wide
      footer={<>
        <Btn t={t} variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn t={t} variant="primary" onClick={save}>Save Quotation</Btn>
      </>}>
      <div style={{ background: '#fff', color: '#000', padding: 20, fontFamily: "Georgia, 'Times New Roman', serif", borderRadius: 8 }}>
        <div className="text-center">
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 0.5 }}>{companyInfo.name}</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>{companyInfo.tagline}</div>
          <div style={{ fontSize: 11 }}>{companyInfo.shopLocation}</div>
        </div>
        <div className="flex justify-between flex-wrap gap-2 mt-2" style={{ fontSize: 10 }}>
          <div>{companyInfo.poBox}<br />{companyInfo.cityCountry}</div>
          <div>Email: <span style={{ textDecoration: 'underline' }}>{companyInfo.email}</span></div>
          <div style={{ textAlign: 'right' }}>Tel: {companyInfo.phone}<br />{companyInfo.phone2}</div>
        </div>
        <div style={{ borderTop: '2px solid #000', margin: '8px 0' }} />

        <div className="flex gap-3 flex-wrap">
          <div style={{ flex: '1.3 1 260px', border: '1px solid #000', padding: 8 }}>
            <div className="flex items-center gap-1" style={{ fontSize: 12 }}>
              <span className="shrink-0">M/s:</span>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer / organisation name *" style={lineInput} list="quote-customer-suggestions" />
            </div>
            <datalist id="quote-customer-suggestions">{customers.map(c => <option key={c.id} value={c.name} />)}</datalist>
            <input value={deliverTo} onChange={e => setDeliverTo(e.target.value)} placeholder="Deliver to / address (optional)" style={{ ...lineInput, marginTop: 6 }} />
            <input value={yourReference} onChange={e => setYourReference(e.target.value)} placeholder="Your reference (optional)" style={{ ...lineInput, marginTop: 6 }} />
          </div>
          <div style={{ flex: '1 1 200px', border: '1px solid #000' }}>
            <div style={{ background: '#000', color: '#fff', textAlign: 'center', padding: '4px 0', fontWeight: 700, fontSize: 12 }}>PROFORMA/INVOICE</div>
            <div className="flex" style={{ borderTop: '1px solid #000' }}>
              <div style={{ padding: '4px 8px', fontSize: 11, borderRight: '1px solid #000', width: 60 }}>No.</div>
              <div style={{ padding: '4px 8px', fontSize: 11, color: '#666' }}>{nextDocNo} (auto)</div>
            </div>
            <div className="flex" style={{ borderTop: '1px solid #000' }}>
              <div style={{ padding: '4px 8px', fontSize: 11, borderRight: '1px solid #000', width: 60 }}>Date</div>
              <div style={{ padding: '4px 8px', fontSize: 11, color: '#666' }}>{todayStr()}</div>
            </div>
            <div className="flex items-center" style={{ borderTop: '1px solid #000' }}>
              <div style={{ padding: '4px 8px', fontSize: 11, borderRight: '1px solid #000', width: 60 }}>Expiry</div>
              <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 11, fontFamily: 'inherit', padding: '2px 8px', background: 'transparent' }} />
            </div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...cell, fontWeight: 700, width: 56 }}>QTY</th>
              <th style={{ ...cell, fontWeight: 700, textAlign: 'left' }}>PARTICULARS</th>
              <th style={{ ...cell, fontWeight: 700, width: 100 }}>RATE</th>
              <th style={{ ...cell, fontWeight: 700, width: 100 }}>AMOUNT</th>
              <th style={{ ...cell, width: 28 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((line, idx) => (
              <tr key={idx}>
                <td style={cell}><input type="number" min="1" value={line.qty} onChange={e => updateLine(idx, { qty: e.target.value })} style={{ ...lineInput, textAlign: 'center', borderBottom: 'none' }} /></td>
                <td style={{ ...cell, textAlign: 'left' }}>
                  <input list="quote-product-suggestions" value={line.description}
                    onChange={e => { const val = e.target.value; const p = products.find(pr => pr.name === val); updateLine(idx, { description: val, unitPrice: p ? p.sellPrice : line.unitPrice }); }}
                    placeholder="Type or pick a product…" style={{ ...lineInput, borderBottom: 'none' }} />
                </td>
                <td style={cell}><input type="number" value={line.unitPrice} onChange={e => updateLine(idx, { unitPrice: e.target.value })} style={{ ...lineInput, textAlign: 'right', borderBottom: 'none' }} /></td>
                <td style={{ ...cell, textAlign: 'right' }}>{fmt((Number(line.qty) || 0) * (Number(line.unitPrice) || 0))}</td>
                <td style={cell}>{items.length > 1 && <button onClick={() => removeLine(idx)}><X size={13} style={{ color: '#c0392b' }} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="quote-product-suggestions">{products.map(p => <option key={p.id} value={p.name} />)}</datalist>
        <button onClick={addLine} className="text-sm mt-2 flex items-center gap-1" style={{ color: '#2563eb' }}><Plus size={13} /> Add line item</button>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
          <tbody>
            <tr><td style={{ ...cell, borderTop: 'none', textAlign: 'left' }}></td><td style={{ ...cell, borderTop: 'none', textAlign: 'right' }}>Sub Total</td><td style={{ ...cell, borderTop: 'none', textAlign: 'right' }}>{fmt(subtotal)}</td></tr>
            <tr>
              <td style={{ ...cell, borderTop: 'none', textAlign: 'left' }}>
                <label className="flex items-center gap-1" style={{ fontSize: 11 }}><input type="checkbox" checked={taxExempt} onChange={e => setTaxExempt(e.target.checked)} /> Tax Exempt</label>
              </td>
              <td style={{ ...cell, borderTop: 'none', textAlign: 'right' }}>VAT {companyInfo.taxRate}%</td>
              <td style={{ ...cell, borderTop: 'none', textAlign: 'right' }}>{fmt(tax)}</td>
            </tr>
            <tr><td style={{ ...cell, borderTop: 'none' }}></td><td style={{ ...cell, borderTop: 'none', textAlign: 'right', fontWeight: 700 }}>Total</td><td style={{ ...cell, borderTop: 'none', textAlign: 'right', fontWeight: 700 }}>{fmt(total)}</td></tr>
          </tbody>
        </table>
        <div className="text-center" style={{ fontWeight: 700, marginTop: 10, fontSize: 12 }}>All accounts are due on demand</div>
      </div>
    </Modal>
  );
}

function QuotationPrintable({ quote, companyInfo }) {
  return (
    <ProformaDocument
      companyInfo={companyInfo}
      docTitle="PROFORMA/INVOICE"
      docNo={quote.docNo}
      date={quote.date}
      customerLines={[
        quote.customerName,
        quote.deliverTo ? `Deliver To: ${quote.deliverTo}` : null,
        quote.yourReference ? `Your Ref: ${quote.yourReference}` : null,
      ].filter(Boolean)}
      items={quote.items.map(i => ({
        qty: i.qty, particulars: i.description,
        rate: i.unitPrice * (1 - i.discPct / 100), amount: i.qty * i.unitPrice * (1 - i.discPct / 100),
      }))}
      subtotal={quote.subtotal}
      vat={quote.tax}
      total={quote.total}
      footer={`All accounts are due on demand. Quotation valid until ${quote.expiry}.`}
    />
  );
}

/* ============================== PURCHASING ============================== */
function Purchasing({ t, suppliers, setSuppliers, products, setProducts, purchaseOrders, setPurchaseOrders, companyInfo, notify, logAudit, addMovement }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ supplierId: suppliers[0]?.id, items: [{ productId: products[0]?.id, qty: 1, unitCost: products[0]?.costPrice || 0 }] });

  const addLine = () => setForm(f => ({ ...f, items: [...f.items, { productId: products[0]?.id, qty: 1, unitCost: products[0]?.costPrice || 0 }] }));
  const updateLine = (idx, key, val) => setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [key]: val } : it) }));
  const removeLine = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const total = form.items.reduce((s, i) => s + i.qty * i.unitCost, 0);

  const createPO = () => {
    if (form.items.some(i => i.qty <= 0 || i.unitCost <= 0)) { notify('Each line item needs a valid quantity and cost.', 'error'); return; }
    const supplier = suppliers.find(s => s.id === +form.supplierId);
    const poNo = `PO-${String(purchaseOrders.length + 1).padStart(4, '0')}`;
    const items = form.items.map(i => ({ ...i, name: products.find(p => p.id === +i.productId)?.name }));
    setPurchaseOrders(prev => [{ id: nextId(), poNo, supplierId: +form.supplierId, supplierName: supplier.name, date: todayStr(), items, total, status: 'Pending', grnNo: null }, ...prev]);
    logAudit({ action: `Created ${poNo}`, module: 'Purchasing', before: '-', after: money(total, companyInfo.currency) });
    notify(`Purchase order ${poNo} created.`);
    setModal(false);
    setForm({ supplierId: suppliers[0]?.id, items: [{ productId: products[0]?.id, qty: 1, unitCost: products[0]?.costPrice || 0 }] });
  };

  const receivePO = (po) => {
    setProducts(prev => prev.map(p => {
      const line = po.items.find(i => +i.productId === p.id);
      return line ? { ...p, stockQty: p.stockQty + +line.qty } : p;
    }));
    po.items.forEach(i => addMovement(+i.productId, 'Purchase', +i.qty, po.poNo));
    setSuppliers(prev => prev.map(s => s.id === po.supplierId ? { ...s, balance: s.balance + po.total } : s));
    const grnNo = `GRN-${String(purchaseOrders.filter(p => p.grnNo).length + 1).padStart(4, '0')}`;
    setPurchaseOrders(prev => prev.map(p => p.id === po.id ? { ...p, status: 'Received', grnNo } : p));
    logAudit({ action: `Received ${po.poNo} (${grnNo})`, module: 'Purchasing', before: 'Pending', after: 'Received' });
    notify(`${po.poNo} received and stock updated (${grnNo}).`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Purchasing</h1>
          <p className="text-sm" style={{ color: t.textMuted }}>{purchaseOrders.filter(p => p.status === 'Pending').length} pending orders</p>
        </div>
        <Btn t={t} variant="primary" icon={Plus} onClick={() => setModal(true)}>New Purchase Order</Btn>
      </div>

      <Card t={t} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{['PO #', 'Supplier', 'Date', 'Items', 'QTY', 'Total', 'Status', 'GRN', ''].map(h => <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>)}</tr></thead>
          <tbody>
            {purchaseOrders.map(po => (
              <tr key={po.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                <td className="px-4 py-3 font-medium" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{po.poNo}</td>
                <td className="px-4 py-3">{po.supplierName}</td>
                <td className="px-4 py-3 text-xs">{po.date}</td>
                <td className="px-4 py-3 text-xs">{po.items.map(i => i.name).join(', ')}</td>
                <td className="px-4 py-3 font-medium">{po.items.reduce((s, i) => s + Number(i.qty || 0), 0)}</td>
                <td className="px-4 py-3">{fmt(po.total)}</td>
                <td className="px-4 py-3"><Badge t={t} tone={po.status === 'Received' ? 'success' : 'warning'}>{po.status}</Badge></td>
                <td className="px-4 py-3 text-xs" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{po.grnNo || '—'}</td>
                <td className="px-4 py-3">{po.status === 'Pending' && <Btn t={t} variant="secondary" onClick={() => receivePO(po)}>Receive</Btn>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {modal && (
        <Modal t={t} title="New Purchase Order" onClose={() => setModal(false)} wide
          footer={<>
            <span className="font-semibold mr-auto">Total: {fmt(total)} {companyInfo.currency}</span>
            <Btn t={t} variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn t={t} variant="primary" onClick={createPO}>Create Order</Btn>
          </>}>
          <Field t={t} label="Supplier"><TSelect t={t} value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</TSelect></Field>
          <div className="mt-3 flex flex-col gap-2">
            {form.items.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5"><Field t={t} label="Product"><TSelect t={t} value={line.productId} onChange={e => updateLine(idx, 'productId', e.target.value)}>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</TSelect></Field></div>
                <div className="col-span-3"><Field t={t} label="Qty"><TInput t={t} type="number" value={line.qty} onChange={e => updateLine(idx, 'qty', +e.target.value)} /></Field></div>
                <div className="col-span-3"><Field t={t} label="Unit Cost"><TInput t={t} type="number" value={line.unitCost} onChange={e => updateLine(idx, 'unitCost', +e.target.value)} /></Field></div>
                <div className="col-span-1 pb-2">{form.items.length > 1 && <button onClick={() => removeLine(idx)}><X size={16} style={{ color: t.danger }} /></button>}</div>
              </div>
            ))}
          </div>
          <button onClick={addLine} className="text-sm mt-2 flex items-center gap-1" style={{ color: t.steel }}><Plus size={14} /> Add line item</button>
        </Modal>
      )}
    </div>
  );
}

/* ============================== CUSTOMERS ============================== */
function Customers({ t, customers, setCustomers, sales, setSales, companyInfo, notify, role, currentUser, logAudit }) {
  const [modal, setModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [statementFor, setStatementFor] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', creditLimit: 0 });
  const isOwner = !!currentUser?.isOwner;
  const canEditStatement = isOwner || role === 'Manager';

  const addCustomer = () => {
    if (!form.name || !form.phone) { notify('Name and phone are required.', 'error'); return; }
    setCustomers(prev => [...prev, { id: nextId(), ...form, balance: 0 }]);
    logAudit({ action: `Added customer ${form.name}`, module: 'Customers', before: '-', after: form.name });
    notify(`Customer "${form.name}" added.`);
    setModal(false); setForm({ name: '', phone: '', email: '', creditLimit: 0 });
  };

  const saveEdit = () => {
    setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? { ...c, ...form } : c));
    logAudit({ action: `Edited customer ${form.name}`, module: 'Customers', before: editingCustomer.name, after: form.name });
    notify(`${form.name} updated.`);
    setEditingCustomer(null);
  };

  const removeCustomer = (c) => {
    if (c.balance > 0) { notify(`Cannot remove ${c.name} — they still owe ${fmt(c.balance)}. Settle the balance first.`, 'error'); return; }
    setCustomers(prev => prev.filter(x => x.id !== c.id));
    logAudit({ action: `Removed customer ${c.name}`, module: 'Customers', before: c.name, after: '-' });
    notify(`${c.name} removed.`);
  };

  const setSaleStatus = (sale, newStatus) => {
    const old = sale.status;
    setSales(prev => prev.map(s => s.id === sale.id ? { ...s, status: newStatus } : s));
    logAudit({ action: `Corrected ${sale.invoiceNo} status`, module: 'Customers', before: old, after: newStatus });
    notify(`${sale.invoiceNo} marked as ${newStatus}.`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Customers</h1><p className="text-sm" style={{ color: t.textMuted }}>{customers.length} customers on file</p></div>
        <Btn t={t} variant="primary" icon={Plus} onClick={() => setModal(true)}>Add Customer</Btn>
      </div>
      <Card t={t} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{['Customer', 'Phone', 'Credit Limit', 'Balance', 'Status', ''].map(h => <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>)}</tr></thead>
          <tbody>
            {customers.map(c => {
              const over = c.creditLimit > 0 && c.balance > c.creditLimit;
              return (
                <tr key={c.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td className="px-4 py-3 font-medium">{c.name}<div className="text-xs font-normal" style={{ color: t.textFaint }}>{c.email}</div></td>
                  <td className="px-4 py-3">{c.phone}</td>
                  <td className="px-4 py-3">{c.creditLimit > 0 ? fmt(c.creditLimit) : '—'}</td>
                  <td className="px-4 py-3">{fmt(c.balance)}</td>
                  <td className="px-4 py-3"><Badge t={t} tone={over ? 'danger' : c.balance > 0 ? 'warning' : 'success'}>{over ? 'Over limit' : c.balance > 0 ? 'Owing' : 'Clear'}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Btn t={t} variant="ghost" icon={FileText} onClick={() => setStatementFor(c)}>Statement</Btn>
                      {isOwner && <button title="Edit" onClick={() => { setEditingCustomer(c); setForm({ name: c.name, phone: c.phone, email: c.email, creditLimit: c.creditLimit }); }}><Pencil size={14} style={{ color: t.textFaint }} /></button>}
                      {isOwner && <button title="Remove" onClick={() => removeCustomer(c)}><Trash2 size={14} style={{ color: t.danger }} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {(modal || editingCustomer) && (
        <Modal t={t} title={editingCustomer ? `Edit ${editingCustomer.name}` : 'Add Customer'} onClose={() => { setModal(false); setEditingCustomer(null); }}
          footer={<>
            <Btn t={t} variant="secondary" onClick={() => { setModal(false); setEditingCustomer(null); }}>Cancel</Btn>
            <Btn t={t} variant="primary" onClick={editingCustomer ? saveEdit : addCustomer}>{editingCustomer ? 'Save Changes' : 'Add Customer'}</Btn>
          </>}>
          <div className="flex flex-col gap-3">
            <Field t={t} label="Full Name *"><TInput t={t} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field t={t} label="Phone *"><TInput t={t} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
            <Field t={t} label="Email"><TInput t={t} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
            <Field t={t} label="Credit Limit"><TInput t={t} type="number" value={form.creditLimit} onChange={e => setForm(f => ({ ...f, creditLimit: +e.target.value }))} /></Field>
          </div>
        </Modal>
      )}

      {statementFor && (
        <Modal t={t} title={`Statement — ${statementFor.name}`} onClose={() => setStatementFor(null)} wide>
          <div className="flex justify-between text-sm mb-3"><span style={{ color: t.textMuted }}>Credit Limit: {fmt(statementFor.creditLimit)}</span><span className="font-semibold">Balance: {fmt(statementFor.balance)} {companyInfo.currency}</span></div>
          {canEditStatement && <p className="text-xs mb-2" style={{ color: t.textFaint }}>As {role}, you can correct a transaction's payment status below. Quantities and amounts stay locked to protect the stock ledger.</p>}
          <table className="w-full text-sm">
            <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{['Invoice', 'Date', 'Amount', 'Status', canEditStatement ? '' : null].filter(Boolean).map(h => <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>)}</tr></thead>
            <tbody>
              {sales.filter(s => s.customerId === statementFor.id).map(s => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td className="px-3 py-2" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{s.invoiceNo}</td>
                  <td className="px-3 py-2 text-xs">{s.date}</td>
                  <td className="px-3 py-2">{fmt(s.total)}</td>
                  <td className="px-3 py-2"><Badge t={t} tone={s.status === 'Paid' ? 'success' : 'warning'}>{s.status}</Badge></td>
                  {canEditStatement && (
                    <td className="px-3 py-2">
                      {s.status === 'Credit'
                        ? <Btn t={t} variant="secondary" onClick={() => setSaleStatus(s, 'Paid')}>Mark Paid</Btn>
                        : <Btn t={t} variant="secondary" onClick={() => setSaleStatus(s, 'Credit')}>Mark Credit</Btn>}
                    </td>
                  )}
                </tr>
              ))}
              {sales.filter(s => s.customerId === statementFor.id).length === 0 && <tr><td colSpan={canEditStatement ? 5 : 4} className="px-3 py-6 text-center text-sm" style={{ color: t.textFaint }}>No transactions yet.</td></tr>}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}

/* ============================== SUPPLIERS ============================== */
function Suppliers({ t, suppliers, setSuppliers, purchaseOrders, companyInfo, notify, role, currentUser, logAudit }) {
  const [payFor, setPayFor] = useState(null);
  const [amount, setAmount] = useState(0);
  const [modal, setModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const canManage = !!currentUser?.isOwner || role === 'Manager';

  const recordPayment = () => {
    if (amount <= 0 || amount > payFor.balance) { notify('Enter a valid amount up to the outstanding balance.', 'error'); return; }
    setSuppliers(prev => prev.map(s => s.id === payFor.id ? { ...s, balance: s.balance - amount } : s));
    logAudit({ action: `Recorded payment of ${amount} to ${payFor.name}`, module: 'Suppliers', before: `Balance: ${payFor.balance}`, after: `Balance: ${payFor.balance - amount}` });
    notify(`Payment of ${money(amount, companyInfo.currency)} recorded for ${payFor.name}.`);
    setPayFor(null); setAmount(0);
  };

  const addSupplier = () => {
    if (!form.name.trim()) { notify('Supplier name is required.', 'error'); return; }
    setSuppliers(prev => [...prev, { id: nextId(), ...form, balance: 0 }]);
    logAudit({ action: `Added supplier ${form.name}`, module: 'Suppliers', before: '-', after: form.name });
    notify(`${form.name} added.`);
    setModal(false); setForm({ name: '', phone: '', email: '' });
  };

  const saveEdit = () => {
    setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? { ...s, ...form } : s));
    logAudit({ action: `Edited supplier ${form.name}`, module: 'Suppliers', before: editingSupplier.name, after: form.name });
    notify(`${form.name} updated.`);
    setEditingSupplier(null);
  };

  const removeSupplier = (s) => {
    if (s.balance > 0) { notify(`Cannot remove ${s.name} — outstanding balance of ${fmt(s.balance)}. Settle it first.`, 'error'); return; }
    setSuppliers(prev => prev.filter(x => x.id !== s.id));
    logAudit({ action: `Removed supplier ${s.name}`, module: 'Suppliers', before: s.name, after: '-' });
    notify(`${s.name} removed.`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Suppliers</h1><p className="text-sm" style={{ color: t.textMuted }}>{suppliers.length} active suppliers</p></div>
        {canManage && <Btn t={t} variant="primary" icon={Plus} onClick={() => setModal(true)}>Add Supplier</Btn>}
      </div>
      <Card t={t} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{['Supplier', 'Contact', 'Purchase Orders', 'Balance Owed', ''].map(h => <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>)}</tr></thead>
          <tbody>
            {suppliers.map(s => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-xs">{s.phone}<br />{s.email}</td>
                <td className="px-4 py-3">{purchaseOrders.filter(p => p.supplierId === s.id).length}</td>
                <td className="px-4 py-3"><Badge t={t} tone={s.balance > 0 ? 'warning' : 'success'}>{fmt(s.balance)}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {s.balance > 0 && <Btn t={t} variant="secondary" onClick={() => { setPayFor(s); setAmount(s.balance); }}>Record Payment</Btn>}
                    {canManage && <button title="Edit" onClick={() => { setEditingSupplier(s); setForm({ name: s.name, phone: s.phone, email: s.email }); }}><Pencil size={14} style={{ color: t.textFaint }} /></button>}
                    {canManage && <button title="Remove" onClick={() => removeSupplier(s)}><Trash2 size={14} style={{ color: t.danger }} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {payFor && (
        <Modal t={t} title={`Record Payment — ${payFor.name}`} onClose={() => setPayFor(null)}
          footer={<>
            <Btn t={t} variant="secondary" onClick={() => setPayFor(null)}>Cancel</Btn>
            <Btn t={t} variant="primary" onClick={recordPayment}>Confirm Payment</Btn>
          </>}>
          <p className="text-sm mb-3" style={{ color: t.textMuted }}>Outstanding balance: {fmt(payFor.balance)} {companyInfo.currency}</p>
          <Field t={t} label="Payment Amount"><TInput t={t} type="number" value={amount} onChange={e => setAmount(+e.target.value)} /></Field>
        </Modal>
      )}
      {(modal || editingSupplier) && (
        <Modal t={t} title={editingSupplier ? `Edit ${editingSupplier.name}` : 'Add Supplier'} onClose={() => { setModal(false); setEditingSupplier(null); }}
          footer={<>
            <Btn t={t} variant="secondary" onClick={() => { setModal(false); setEditingSupplier(null); }}>Cancel</Btn>
            <Btn t={t} variant="primary" onClick={editingSupplier ? saveEdit : addSupplier}>{editingSupplier ? 'Save Changes' : 'Add Supplier'}</Btn>
          </>}>
          <div className="flex flex-col gap-3">
            <Field t={t} label="Supplier Name *"><TInput t={t} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field t={t} label="Phone"><TInput t={t} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
            <Field t={t} label="Email"><TInput t={t} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================== RETURNS ============================== */
function ReturnsModule({ t, products, setProducts, sales, customers, setCustomers, suppliers, setSuppliers, returns, setReturns, companyInfo, notify, addMovement, logAudit }) {
  const [tab, setTab] = useState('customer');
  const [form, setForm] = useState({ productId: products[0]?.id, qty: 1, reason: '', condition: 'Resellable', customerId: customers[0]?.id, supplierId: suppliers[0]?.id });

  const submitReturn = () => {
    if (form.qty <= 0 || !form.reason) { notify('Enter a valid quantity and reason.', 'error'); return; }
    const product = products.find(p => p.id === +form.productId);
    const refNo = `RET-${String(returns.length + 1).padStart(4, '0')}`;
    if (tab === 'customer') {
      const resellable = form.condition === 'Resellable';
      if (resellable) { setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stockQty: p.stockQty + +form.qty } : p)); addMovement(product.id, 'Return-In', +form.qty, refNo); }
      const refundAmt = product.sellPrice * form.qty;
      setCustomers(prev => prev.map(c => c.id === +form.customerId ? { ...c, balance: Math.max(0, c.balance - refundAmt) } : c));
      setReturns(prev => [{ id: nextId(), type: 'Customer', refNo, partyName: customers.find(c => c.id === +form.customerId)?.name, productId: product.id, productName: product.name, qty: form.qty, reason: form.reason, condition: form.condition, date: todayStr() }, ...prev]);
      logAudit({ action: `Processed customer return ${refNo}`, module: 'Returns', before: `Stock: ${product.stockQty}`, after: `Stock: ${resellable ? product.stockQty + +form.qty : product.stockQty}` });
      notify(`Customer return ${refNo} processed.`);
    } else {
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stockQty: Math.max(0, p.stockQty - form.qty) } : p));
      addMovement(product.id, 'Return-Out', -form.qty, refNo);
      const creditAmt = product.costPrice * form.qty;
      setSuppliers(prev => prev.map(s => s.id === +form.supplierId ? { ...s, balance: Math.max(0, s.balance - creditAmt) } : s));
      setReturns(prev => [{ id: nextId(), type: 'Supplier', refNo, partyName: suppliers.find(s => s.id === +form.supplierId)?.name, productId: product.id, productName: product.name, qty: form.qty, reason: form.reason, condition: form.condition, date: todayStr() }, ...prev]);
      logAudit({ action: `Processed supplier return ${refNo}`, module: 'Returns', before: `Stock: ${product.stockQty}`, after: `Stock: ${product.stockQty - form.qty}` });
      notify(`Supplier return ${refNo} processed.`);
    }
    setForm(f => ({ ...f, qty: 1, reason: '' }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div><h1 className="text-xl font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Returns</h1><p className="text-sm" style={{ color: t.textMuted }}>Customer and supplier returns with automatic stock & balance adjustment.</p></div>
      <div className="flex gap-2">
        {['customer', 'supplier'].map(k => (
          <button key={k} onClick={() => setTab(k)} className="px-4 py-2 rounded-md text-sm font-medium capitalize" style={{ background: tab === k ? THEMES_ACCENT_SOFT(t) : t.surfaceAlt, color: tab === k ? t.accent : t.textMuted }}>{k} Returns</button>
        ))}
      </div>
      <Card t={t} className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <Field t={t} label="Product"><TSelect t={t} value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</TSelect></Field>
          <Field t={t} label={tab === 'customer' ? 'Customer' : 'Supplier'}>
            <TSelect t={t} value={tab === 'customer' ? form.customerId : form.supplierId} onChange={e => setForm(f => ({ ...f, [tab === 'customer' ? 'customerId' : 'supplierId']: e.target.value }))}>
              {(tab === 'customer' ? customers : suppliers).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </TSelect>
          </Field>
          <Field t={t} label="Quantity"><TInput t={t} type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: +e.target.value }))} /></Field>
          <Field t={t} label="Condition"><TSelect t={t} value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}><option>Resellable</option><option>Damaged</option></TSelect></Field>
        </div>
        <div className="mt-3"><Field t={t} label="Reason"><TInput t={t} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Wrong part ordered, defective unit…" /></Field></div>
        <div className="mt-3 flex justify-end"><Btn t={t} variant="primary" onClick={submitReturn}>Process {tab === 'customer' ? 'Customer' : 'Supplier'} Return</Btn></div>
      </Card>
      <Card t={t} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{['Ref #', 'Type', 'Party', 'Product', 'Qty', 'Condition', 'Reason', 'Date'].map(h => <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>)}</tr></thead>
          <tbody>
            {returns.map(r => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                <td className="px-4 py-3" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{r.refNo}</td>
                <td className="px-4 py-3"><Badge t={t} tone="steel">{r.type}</Badge></td>
                <td className="px-4 py-3">{r.partyName}</td>
                <td className="px-4 py-3">{r.productName}</td>
                <td className="px-4 py-3">{r.qty}</td>
                <td className="px-4 py-3">{r.condition}</td>
                <td className="px-4 py-3 text-xs">{r.reason}</td>
                <td className="px-4 py-3 text-xs">{r.date}</td>
              </tr>
            ))}
            {returns.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: t.textFaint }}>No returns processed yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
function THEMES_ACCENT_SOFT(t) { return t.accentSoft; }

/* ============================== REPORTS ============================== */
function Reports({ t, products, sales, purchaseOrders, customers, suppliers, movements, returns, companyInfo, notify }) {
  const [active, setActive] = useState('inventory');
  const reportList = [
    { id: 'inventory', label: 'Inventory Valuation', icon: Package },
    { id: 'movement', label: 'Stock Movement', icon: History },
    { id: 'lowstock', label: 'Low Stock', icon: AlertTriangle },
    { id: 'sales', label: 'Sales Report', icon: ShoppingCart },
    { id: 'profit', label: 'Profit & Loss', icon: Wallet },
    { id: 'purchases', label: 'Purchases', icon: Truck },
    { id: 'customers', label: 'Customer Balances', icon: Users },
    { id: 'suppliers', label: 'Supplier Balances', icon: Building2 },
    { id: 'returns', label: 'Returns Report', icon: RotateCcw },
    { id: 'movers', label: 'Fast/Slow Movers', icon: TrendingDown },
  ];

  const exportInventory = () => downloadCSV('inventory-valuation.csv', [['SKU', 'Name', 'Category', 'Stock', 'Cost Price', 'Value'], ...products.map(p => [p.sku, p.name, p.category, p.stockQty, p.costPrice, p.stockQty * p.costPrice])]);
  const exportSales = () => downloadCSV('sales-report.csv', [['Invoice', 'Date', 'Customer', 'Total', 'Status'], ...sales.map(s => [s.invoiceNo, s.date, s.customerName, s.total, s.status])]);
  const exportReturns = () => downloadCSV('returns-report.csv', [['Ref #', 'Type', 'Product', 'Qty', 'Party', 'Condition', 'Reason', 'Date'], ...returns.map(r => [r.refNo, r.type, r.productName, r.qty, r.partyName, r.condition, r.reason, r.date])]);

  return (
    <div className="flex flex-col gap-4">
      <div><h1 className="text-xl font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Reports</h1><p className="text-sm" style={{ color: t.textMuted }}>All figures calculated live from current inventory, sales and purchase data.</p></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {reportList.map(r => {
          const Icon = r.icon; const isActive = active === r.id;
          return (
            <button key={r.id} onClick={() => setActive(r.id)} className="p-3 rounded-lg text-left flex flex-col gap-2" style={{ background: isActive ? t.accentSoft : t.surface, border: `1px solid ${isActive ? t.accent : t.border}` }}>
              <Icon size={16} style={{ color: isActive ? t.accent : t.textMuted }} />
              <span className="text-xs font-medium" style={{ color: isActive ? t.accent : t.text }}>{r.label}</span>
            </button>
          );
        })}
      </div>

      <Card t={t} className="p-4">
        {active === 'inventory' && (
          <ReportTable t={t} title="Inventory Valuation" onExport={exportInventory}
            head={['SKU', 'Name', 'Category', 'Stock', 'Cost Price', 'Value']}
            rows={products.map(p => [p.sku, p.name, p.category, p.stockQty, fmt(p.costPrice), fmt(p.stockQty * p.costPrice)])}
            footer={`Total Inventory Value: ${money(products.reduce((s, p) => s + p.stockQty * p.costPrice, 0), companyInfo.currency)}`} />
        )}
        {active === 'movement' && (
          <ReportTable t={t} title="Stock Movement Ledger"
            head={['Date', 'Product', 'Type', 'Qty Change', 'Balance After', 'Reference']}
            rows={movements.slice(0, 40).map(m => [m.date, products.find(p => p.id === m.productId)?.name, m.type, m.qtyChange, m.balanceAfter, m.reference])} />
        )}
        {active === 'lowstock' && (
          <ReportTable t={t} title="Low Stock Report"
            head={['SKU', 'Name', 'Stock', 'Reorder Level', 'Location']}
            rows={products.filter(p => p.stockQty <= p.reorderLevel).map(p => [p.sku, p.name, p.stockQty, p.reorderLevel, p.location])} />
        )}
        {active === 'sales' && (
          <ReportTable t={t} title="Sales Report" onExport={exportSales}
            head={['Invoice', 'Date', 'Customer', 'Total', 'Status']}
            rows={sales.map(s => [s.invoiceNo, s.date, s.customerName, fmt(s.total), s.status])}
            footer={`Total Revenue: ${money(sales.reduce((s, x) => s + x.total, 0), companyInfo.currency)}`} />
        )}
        {active === 'profit' && (
          <ReportTable t={t} title="Profit & Loss (session)"
            head={['Invoice', 'Revenue', 'COGS', 'Gross Profit']}
            rows={sales.map(s => { const cogs = s.items.reduce((a, i) => a + i.cost * i.qty, 0); return [s.invoiceNo, fmt(s.total), fmt(cogs), fmt(s.total - cogs)]; })}
            footer={`Gross Profit: ${money(sales.reduce((s, x) => s + (x.total - x.items.reduce((a, i) => a + i.cost * i.qty, 0)), 0), companyInfo.currency)}`} />
        )}
        {active === 'purchases' && (
          <ReportTable t={t} title="Purchases Report"
            head={['PO #', 'Supplier', 'Date', 'Total', 'Status']}
            rows={purchaseOrders.map(p => [p.poNo, p.supplierName, p.date, fmt(p.total), p.status])} />
        )}
        {active === 'customers' && (
          <ReportTable t={t} title="Customer Balances"
            head={['Customer', 'Credit Limit', 'Balance']}
            rows={customers.map(c => [c.name, c.creditLimit ? fmt(c.creditLimit) : '—', fmt(c.balance)])}
            footer={`Total Receivables: ${money(customers.reduce((s, c) => s + c.balance, 0), companyInfo.currency)}`} />
        )}
        {active === 'suppliers' && (
          <ReportTable t={t} title="Supplier Balances"
            head={['Supplier', 'Balance Owed']}
            rows={suppliers.map(s => [s.name, fmt(s.balance)])}
            footer={`Total Payables: ${money(suppliers.reduce((s, x) => s + x.balance, 0), companyInfo.currency)}`} />
        )}
        {active === 'returns' && (
          <ReportTable t={t} title="Returns Report" onExport={exportReturns}
            head={['Ref #', 'Type', 'Product', 'Qty', 'Party', 'Condition', 'Reason', 'Date']}
            rows={returns.map(r => [r.refNo, r.type, r.productName, r.qty, r.partyName, r.condition, r.reason, r.date])}
            footer={`Total Returns: ${returns.length} (${returns.filter(r => r.type === 'Customer').length} customer, ${returns.filter(r => r.type === 'Supplier').length} supplier)`} />
        )}
        {active === 'movers' && (
          <ReportTable t={t} title="Fast / Slow Moving Products (by stock turnover proxy)"
            head={['Name', 'Stock', 'Reorder Level', 'Movement']}
            rows={products.map(p => [p.name, p.stockQty, p.reorderLevel, p.stockQty <= p.reorderLevel ? 'Fast-moving (reorder soon)' : 'Normal'])} />
        )}
      </Card>
    </div>
  );
}

function ReportTable({ t, title, head, rows, footer }) {
  const exportCSV = () => downloadCSV(`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`, [head, ...rows]);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{title}</h3>
        <Btn t={t} variant="secondary" icon={Download} onClick={exportCSV} disabled={rows.length === 0}>Export CSV</Btn>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{head.map(h => <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i} style={{ borderBottom: `1px solid ${t.border}` }}>{r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>)}
            {rows.length === 0 && <tr><td colSpan={head.length} className="px-3 py-6 text-center text-sm" style={{ color: t.textFaint }}>No data to display.</td></tr>}
          </tbody>
        </table>
      </div>
      {footer && <div className="text-right text-sm font-semibold mt-3 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>{footer}</div>}
    </div>
  );
}

/* ============================== USERS & SECURITY ============================== */
function UsersSecurity({ t, users, setUsers, permissions, setPermissions, auditLog, currentUser, notify, logAudit }) {
  const roles = Object.keys(permissions);
  const isOwner = !!currentUser?.isOwner;
  const [editingUser, setEditingUser] = useState(null); // null = closed, 'new' = create, or a user object = edit
  const VALID_ROLES = ['Admin', 'Manager', 'Sales', 'Inventory', 'Accountant'];

  const togglePermission = (r, moduleId) => {
    if (!isOwner) return;
    setPermissions(prev => {
      const has = prev[r].includes(moduleId);
      const updated = { ...prev, [r]: has ? prev[r].filter(m => m !== moduleId) : [...prev[r], moduleId] };
      logAudit({ action: `${has ? 'Removed' : 'Granted'} "${moduleId}" access for role ${r}`, module: 'Users & Security', before: has ? 'Had access' : 'No access', after: has ? 'No access' : 'Has access' });
      return updated;
    });
  };

  const toggleStatus = (u) => {
    if (!isOwner) return;
    if (u.isOwner) { notify('The owner account cannot be deactivated.', 'error'); return; }
    const newStatus = u.status === 'Active' ? 'Inactive' : 'Active';
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: newStatus } : x));
    logAudit({ action: `Set ${u.name} to ${newStatus}`, module: 'Users & Security', before: u.status, after: newStatus });
    notify(`${u.name} is now ${newStatus}.`);
  };

  const saveUser = (form) => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) { notify('Name, email and password are all required.', 'error'); return; }
    if (form.id) {
      const old = users.find(u => u.id === form.id);
      setUsers(prev => prev.map(u => u.id === form.id ? { ...u, ...form } : u));
      logAudit({ action: `Edited user ${form.name}`, module: 'Users & Security', before: `Role: ${old.role}`, after: `Role: ${form.role}` });
      notify(`${form.name} updated.`);
    } else {
      const newUser = { id: nextId(), ...form, isOwner: false, lastLogin: 'Never' };
      setUsers(prev => [...prev, newUser]);
      logAudit({ action: `Created user ${form.name} (${form.role})`, module: 'Users & Security', before: '-', after: form.role });
      notify(`${form.name} added.`);
    }
    setEditingUser(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Users & Security</h1>
          <p className="text-sm" style={{ color: t.textMuted }}>Role-based access control and a full audit trail of sensitive actions.</p>
        </div>
        {isOwner ? <Btn t={t} variant="primary" icon={Plus} onClick={() => setEditingUser('new')}>Add User</Btn>
          : <Badge t={t} tone="muted">Only the owner can edit users and permissions</Badge>}
      </div>

      <Card t={t} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{['Name', 'Email', 'Role', 'Status', 'Last Login', ''].map(h => <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>)}</tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                <td className="px-4 py-3 font-medium">{u.name} {u.isOwner && <Badge t={t} tone="accent">Owner</Badge>}</td>
                <td className="px-4 py-3 text-xs">{u.email}</td>
                <td className="px-4 py-3"><Badge t={t} tone="steel">{u.role}</Badge></td>
                <td className="px-4 py-3">
                  {isOwner && !u.isOwner
                    ? <button onClick={() => toggleStatus(u)}><Badge t={t} tone={u.status === 'Active' ? 'success' : 'muted'}>{u.status}</Badge></button>
                    : <Badge t={t} tone={u.status === 'Active' ? 'success' : 'muted'}>{u.status}</Badge>}
                </td>
                <td className="px-4 py-3 text-xs">{u.lastLogin}</td>
                <td className="px-4 py-3">{isOwner && <button onClick={() => setEditingUser(u)}><Pencil size={14} style={{ color: t.textFaint }} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card t={t} className="p-4 overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Permission Matrix</h3>
          {isOwner && <span className="text-xs" style={{ color: t.textFaint }}>Click a cell to toggle access</span>}
        </div>
        <table className="text-sm min-w-full">
          <thead><tr><th className="text-left px-3 py-2" style={{ color: t.textFaint, fontSize: 12 }}>Module</th>{roles.map(r => <th key={r} className="px-3 py-2 text-center" style={{ color: t.textFaint, fontSize: 12 }}>{r}</th>)}</tr></thead>
          <tbody>
            {NAV_ITEMS.map(n => (
              <tr key={n.id} style={{ borderTop: `1px solid ${t.border}` }}>
                <td className="px-3 py-2">{n.label}</td>
                {roles.map(r => {
                  const has = permissions[r].includes(n.id);
                  return (
                    <td key={r} className="px-3 py-2 text-center">
                      <button disabled={!isOwner} onClick={() => togglePermission(r, n.id)} style={{ cursor: isOwner ? 'pointer' : 'default' }}>
                        {has ? <CheckCircle2 size={15} style={{ color: t.success, margin: '0 auto' }} /> : <span style={{ color: t.textFaint }}>—</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card t={t} className="p-4 overflow-x-auto">
        <h3 className="font-semibold text-sm mb-3" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Audit Log</h3>
        <table className="w-full text-sm">
          <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{['Date/Time', 'User', 'Role', 'Action', 'Module', 'Before', 'After'].map(h => <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>)}</tr></thead>
          <tbody>
            {auditLog.map(a => (
              <tr key={a.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                <td className="px-3 py-2 text-xs">{a.date}</td>
                <td className="px-3 py-2">{a.user}</td>
                <td className="px-3 py-2"><Badge t={t} tone="steel">{a.role}</Badge></td>
                <td className="px-3 py-2">{a.action}</td>
                <td className="px-3 py-2 text-xs">{a.module}</td>
                <td className="px-3 py-2 text-xs" style={{ color: t.textFaint }}>{a.before}</td>
                <td className="px-3 py-2 text-xs">{a.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editingUser && (
        <UserEditModal t={t} user={editingUser === 'new' ? null : editingUser} onClose={() => setEditingUser(null)} onSave={saveUser} validRoles={VALID_ROLES} />
      )}
    </div>
  );
}

function UserEditModal({ t, user, onClose, onSave, validRoles }) {
  const [form, setForm] = useState(user
    ? { id: user.id, name: user.name, email: user.email, password: user.password, role: user.role, status: user.status }
    : { name: '', email: '', password: '', role: 'Sales', status: 'Active' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal t={t} title={user ? `Edit ${user.name}` : 'Add User'} onClose={onClose}
      footer={<>
        <Btn t={t} variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn t={t} variant="primary" onClick={() => onSave(form)}>{user ? 'Save Changes' : 'Add User'}</Btn>
      </>}>
      <div className="flex flex-col gap-3">
        <Field t={t} label="Full Name *"><TInput t={t} value={form.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field t={t} label="Email *"><TInput t={t} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
        <Field t={t} label="Password *"><TInput t={t} value={form.password} onChange={e => set('password', e.target.value)} placeholder={user ? 'Leave as-is or set a new one' : ''} /></Field>
        <Field t={t} label="Role"><TSelect t={t} value={form.role} onChange={e => set('role', e.target.value)}>{validRoles.map(r => <option key={r}>{r}</option>)}</TSelect></Field>
        <Field t={t} label="Status"><TSelect t={t} value={form.status} onChange={e => set('status', e.target.value)}><option>Active</option><option>Inactive</option></TSelect></Field>
      </div>
    </Modal>
  );
}

/* ============================== SETTINGS ============================== */
function SettingsPage({ t, companyInfo, setCompanyInfo, notify, role }) {
  const [form, setForm] = useState(companyInfo);
  const [saving, setSaving] = useState(false);
  const canEdit = role === 'Admin';
  useEffect(() => setForm(companyInfo), [companyInfo]); // keep the form in sync once the real fetch resolves
  const save = async () => {
    setSaving(true);
    try {
      const data = await api.updateSettings(settingsToApi(form));
      const updated = settingsFromApi(data.settings);
      setCompanyInfo(updated);
      setForm(updated);
      notify('Settings saved.');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div><h1 className="text-xl font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Settings</h1><p className="text-sm" style={{ color: t.textMuted }}>Company information, tax, currency and document numbering.</p></div>
      {!canEdit && (
        <div className="text-xs p-3 rounded-md" style={{ background: t.warningSoft, color: t.warning }}>
          Only the Admin can edit company settings. You can view the current configuration below.
        </div>
      )}
      <Card t={t} className="p-5 flex flex-col gap-4">
        <div className="flex items-center gap-4 p-3 rounded-md" style={{ background: t.surfaceAlt }}>
          {form.logo
            ? <img src={form.logo} alt="Company logo" className="rounded-lg object-contain" style={{ width: 80, height: 80, background: '#fff' }} />
            : <div className="rounded-lg flex items-center justify-center" style={{ width: 80, height: 80, background: t.accentSoft, color: t.accent, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>LOGO</div>}
          <div className="flex-1 flex flex-col gap-2 min-w-[200px]">
            <div className="text-sm font-medium" style={{ color: t.text }}>Company Logo <span className="font-normal" style={{ color: t.textFaint }}>(optional)</span></div>
            {canEdit ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer" style={{ background: t.accent, color: '#fff' }}>
                    Upload from device
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => set('logo', reader.result);
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                  {form.logo && <button type="button" onClick={() => set('logo', '')} className="text-xs underline" style={{ color: t.textFaint }}>Clear</button>}
                </div>
                <p className="text-xs" style={{ color: t.textFaint }}>Shown on printed quotations and invoices. Leave blank to use the company name as plain text instead.</p>
              </>
            ) : (
              <p className="text-xs" style={{ color: t.textFaint }}>{form.logo ? 'A logo is set.' : 'No logo uploaded yet.'}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field t={t} label="Company Name"><TInput t={t} disabled={!canEdit} value={form.name} onChange={e => set('name', e.target.value)} /></Field>
          <Field t={t} label="Currency"><TSelect t={t} disabled={!canEdit} value={form.currency} onChange={e => set('currency', e.target.value)}><option>UGX</option><option>USD</option><option>KES</option><option>TZS</option></TSelect></Field>
          <Field t={t} label="Phone (primary)"><TInput t={t} disabled={!canEdit} value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
          <Field t={t} label="Phone (secondary)"><TInput t={t} disabled={!canEdit} value={form.phone2} onChange={e => set('phone2', e.target.value)} /></Field>
          <Field t={t} label="Email"><TInput t={t} disabled={!canEdit} value={form.email} onChange={e => set('email', e.target.value)} /></Field>
          <Field t={t} label="Tax Rate (%)"><TInput t={t} type="number" disabled={!canEdit} value={form.taxRate} onChange={e => set('taxRate', +e.target.value)} /></Field>
          <Field t={t} label="P.O. Box"><TInput t={t} disabled={!canEdit} value={form.poBox} onChange={e => set('poBox', e.target.value)} /></Field>
          <Field t={t} label="City / Country"><TInput t={t} disabled={!canEdit} value={form.cityCountry} onChange={e => set('cityCountry', e.target.value)} /></Field>
          <Field t={t} label="Invoice Prefix"><TInput t={t} disabled={!canEdit} value={form.invoicePrefix} onChange={e => set('invoicePrefix', e.target.value)} /></Field>
        </div>
        <Field t={t} label="Tagline (shown under company name on printed documents)"><TInput t={t} disabled={!canEdit} value={form.tagline} onChange={e => set('tagline', e.target.value)} /></Field>
        <Field t={t} label="Shop / Office Location"><TInput t={t} disabled={!canEdit} value={form.shopLocation} onChange={e => set('shopLocation', e.target.value)} /></Field>
        <Field t={t} label="Address (general use)"><TInput t={t} disabled={!canEdit} value={form.address} onChange={e => set('address', e.target.value)} /></Field>
        <Field t={t} label="Document Footer (e.g. payment terms)"><TInput t={t} disabled={!canEdit} value={form.receiptFooter} onChange={e => set('receiptFooter', e.target.value)} /></Field>
        {canEdit && <div className="flex justify-end"><Btn t={t} variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</Btn></div>}
      </Card>
    </div>
  );
}

/* ============================== INVENTORY CONTROL CENTER ============================== */
function InventoryControlCenter({ t, products, setProducts, movements, addMovement, sales, purchaseOrders, suppliers, customers, returns, companyInfo, notify, logAudit, role, setActiveModule }) {
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [adjForm, setAdjForm] = useState({ productId: products[0]?.id, direction: 'Increase', qty: 1, reason: '' });
  const canAdjust = ['Admin', 'Manager', 'Inventory'].includes(role);

  const today = todayStr();
  const totalUnits = products.reduce((s, p) => s + p.stockQty, 0);
  const totalValue = products.reduce((s, p) => s + p.stockQty * p.costPrice, 0);
  const stockInToday = movements.filter(m => m.date.slice(0, 10) === today && m.qtyChange > 0 && m.type !== 'Opening Stock').reduce((s, m) => s + m.qtyChange, 0);
  const stockOutToday = movements.filter(m => m.date.slice(0, 10) === today && m.qtyChange < 0).reduce((s, m) => s + Math.abs(m.qtyChange), 0);
  const lowStockItems = products.filter(p => p.stockQty > 0 && p.stockQty <= p.reorderLevel);
  const outOfStockItems = products.filter(p => p.stockQty === 0);
  const overstockItems = products.filter(p => p.maxStock && p.stockQty > p.maxStock);
  const damagedQty = movements.filter(m => m.type === 'Adjustment-Damage').reduce((s, m) => s + Math.abs(m.qtyChange), 0)
    + returns.filter(r => r.condition === 'Damaged').reduce((s, r) => s + r.qty, 0);

  const filteredProducts = products.filter(p =>
    (categoryFilter === 'All' || p.category === categoryFilter) &&
    (statusFilter === 'All' || productStatus(p) === statusFilter) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()) || p.partNumber.toLowerCase().includes(search.toLowerCase()))
  );

  const submitAdjustment = () => {
    if (!adjForm.reason.trim() || adjForm.qty <= 0) { notify('Enter a quantity and a mandatory reason.', 'error'); return; }
    const product = products.find(p => p.id === +adjForm.productId);
    const isDamage = adjForm.direction === 'Damage';
    const delta = (adjForm.direction === 'Increase') ? +adjForm.qty : -adjForm.qty;
    if (delta < 0 && product.stockQty + delta < 0) { notify('Cannot reduce stock below zero.', 'error'); return; }
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stockQty: p.stockQty + delta } : p));
    const type = isDamage ? 'Adjustment-Damage' : 'Adjustment';
    const ref = `ADJ-${nextId()} (${adjForm.reason})`;
    addMovement(product.id, type, delta, ref);
    logAudit({ action: `Stock adjustment on ${product.name}: ${delta > 0 ? '+' : ''}${delta} — ${adjForm.reason}`, module: 'Inventory Control Center', before: `Stock: ${product.stockQty}`, after: `Stock: ${product.stockQty + delta}` });
    notify(`Adjustment recorded for ${product.name}.`);
    setAdjForm({ productId: products[0]?.id, direction: 'Increase', qty: 1, reason: '' });
  };

  const exportAllStock = () => downloadCSV('all-stock.csv', [['SKU', 'Name', 'Category', 'Qty', 'Min', 'Max', 'Cost', 'Sell', 'Value', 'Status'], ...filteredProducts.map(p => [p.sku, p.name, p.category, p.stockQty, p.reorderLevel, p.maxStock, p.costPrice, p.sellPrice, p.stockQty * p.costPrice, productStatus(p)])]);
  const exportValuation = () => downloadCSV('stock-valuation.csv', [['Category', 'Units', 'Value'], ...CATEGORIES.map(c => { const items = products.filter(p => p.category === c); return [c, items.reduce((s, p) => s + p.stockQty, 0), items.reduce((s, p) => s + p.stockQty * p.costPrice, 0)]; })]);

  const stockInRows = movements.filter(m => ['Purchase', 'Return-In'].includes(m.type)).map(m => {
    const product = products.find(p => p.id === m.productId);
    const po = purchaseOrders.find(p => p.poNo === m.reference);
    return { ...m, productName: product?.name, supplier: po?.supplierName || (m.type === 'Return-In' ? 'Customer Return' : '—'), cost: po ? (po.items.find(i => +i.productId === m.productId)?.unitCost) : product?.costPrice };
  });
  const stockOutRows = movements.filter(m => m.qtyChange < 0 && m.type !== 'Opening Stock').map(m => {
    const product = products.find(p => p.id === m.productId);
    const sale = sales.find(s => s.invoiceNo === m.reference);
    let reasonLabel = 'Sale', partyLabel = sale?.customerName || '—';
    if (m.type === 'Return-Out') { const ret = returns.find(r => m.reference === r.refNo); reasonLabel = 'Supplier Return'; partyLabel = ret?.partyName || '—'; }
    if (m.type === 'Adjustment') { reasonLabel = 'Adjustment'; partyLabel = '—'; }
    if (m.type === 'Adjustment-Damage') { reasonLabel = 'Damage'; partyLabel = '—'; }
    return { ...m, productName: product?.name, reasonLabel, partyLabel };
  });

  const TABS = [
    { id: 'all', label: 'All Stock' },
    { id: 'stockin', label: 'Stock-In' },
    { id: 'stockout', label: 'Stock-Out' },
    { id: 'low', label: 'Low Stock' },
    { id: 'out', label: 'Out of Stock' },
    { id: 'adjust', label: 'Stock Adjustments' },
    { id: 'history', label: 'Movement History' },
    { id: 'valuation', label: 'Stock Valuation' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Inventory Control Center</h1>
          <p className="text-sm" style={{ color: t.textMuted }}>Complete real-time stock position, computed live from every purchase, sale, return and adjustment.</p>
        </div>
        <Btn t={t} variant="secondary" onClick={() => setActiveModule('dashboard')}>← Back to Dashboard</Btn>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard t={t} label="Total Products" value={products.length} icon={Package} tone="steel" />
        <StatCard t={t} label="Total Units" value={fmt(totalUnits)} icon={Boxes} tone="steel" />
        <StatCard t={t} label="Inventory Value" value={money(totalValue, companyInfo.currency)} icon={Wallet} tone="accent" />
        <StatCard t={t} label="Stock-In Today" value={fmt(stockInToday)} icon={ArrowDownCircle} tone="success" />
        <StatCard t={t} label="Stock-Out Today" value={fmt(stockOutToday)} icon={ArrowUpCircle} tone="warning" />
        <StatCard t={t} label="Low Stock" value={lowStockItems.length} icon={AlertTriangle} tone="warning" />
        <StatCard t={t} label="Out of Stock" value={outOfStockItems.length} icon={PackageX} tone="danger" />
        <StatCard t={t} label="Overstock" value={overstockItems.length} icon={Boxes} tone="steel" />
        <StatCard t={t} label="Damaged Stock" value={fmt(damagedQty)} icon={AlertTriangle} tone="danger" />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} className="px-3.5 py-2 rounded-md text-sm font-medium"
            style={{ background: tab === tb.id ? t.accentSoft : t.surface, border: `1px solid ${tab === tb.id ? t.accent : t.border}`, color: tab === tb.id ? t.accent : t.textMuted }}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'all' && (
        <Card t={t} className="p-4">
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md flex-1 min-w-[200px]" style={{ background: t.surfaceAlt, border: `1px solid ${t.border}` }}>
              <Search size={15} style={{ color: t.textFaint }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, SKU, part number…" className="bg-transparent outline-none text-sm w-full" style={{ color: t.text }} />
            </div>
            <TSelect t={t} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ width: 180 }}><option>All</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</TSelect>
            <TSelect t={t} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160 }}><option>All</option><option>Normal</option><option>Low Stock</option><option>Out of Stock</option><option>Overstock</option></TSelect>
            <Btn t={t} variant="secondary" icon={Download} onClick={exportAllStock}>Export CSV</Btn>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{['Product', 'SKU', 'Part #', 'Category', 'Qty', 'Min', 'Max', 'Cost', 'Sell', 'Value', 'Status'].map(h => <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>)}</tr></thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.id} onClick={() => setSelected(p)} className="cursor-pointer" style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td className="px-3 py-2"><div className="flex items-center gap-2"><ProductThumb t={t} product={p} size={32} />{p.name}</div></td>
                    <td className="px-3 py-2" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{p.sku}</td>
                    <td className="px-3 py-2 text-xs" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{p.partNumber}</td>
                    <td className="px-3 py-2">{p.category}</td>
                    <td className="px-3 py-2 font-medium">{p.stockQty}</td>
                    <td className="px-3 py-2">{p.reorderLevel}</td>
                    <td className="px-3 py-2">{p.maxStock}</td>
                    <td className="px-3 py-2">{fmt(p.costPrice)}</td>
                    <td className="px-3 py-2">{fmt(p.sellPrice)}</td>
                    <td className="px-3 py-2">{fmt(p.stockQty * p.costPrice)}</td>
                    <td className="px-3 py-2"><Badge t={t} tone={statusTone(productStatus(p))}>{productStatus(p)}</Badge></td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && <tr><td colSpan={11} className="px-3 py-8 text-center text-sm" style={{ color: t.textFaint }}>No products match your filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'stockin' && (
        <ReportTable t={t} title="Stock Received (Stock-In)" head={['Date', 'Product', 'Qty', 'Supplier', 'Reference', 'Cost', 'User']}
          rows={stockInRows.map(m => [m.date, m.productName, `+${m.qtyChange}`, m.supplier, m.reference, fmt(m.cost || 0), m.user])} />
      )}

      {tab === 'stockout' && (
        <ReportTable t={t} title="Stock Leaving the Business (Stock-Out)" head={['Date', 'Product', 'Qty', 'Customer / Order', 'Reason', 'User']}
          rows={stockOutRows.map(m => [m.date, m.productName, Math.abs(m.qtyChange), m.partyLabel, m.reasonLabel, m.user])} />
      )}

      {tab === 'low' && (
        <ReportTable t={t} title="Low Stock — Recommended Reorder" head={['SKU', 'Product', 'Current Qty', 'Min Level', 'Max Level', 'Recommended Reorder Qty']}
          rows={lowStockItems.map(p => [p.sku, p.name, p.stockQty, p.reorderLevel, p.maxStock, Math.max((p.maxStock || p.reorderLevel * 3) - p.stockQty, p.reorderLevel)])} />
      )}

      {tab === 'out' && (
        <ReportTable t={t} title="Out of Stock Products" head={['SKU', 'Product', 'Category', 'Min Level', 'Location']}
          rows={outOfStockItems.map(p => [p.sku, p.name, p.category, p.reorderLevel, p.location])} />
      )}

      {tab === 'adjust' && (
        <Card t={t} className="p-4">
          <h3 className="font-semibold text-sm mb-3" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>New Stock Adjustment</h3>
          {!canAdjust && <p className="text-sm mb-3" style={{ color: t.warning }}>Your role can view adjustments but is not authorized to create them.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <Field t={t} label="Product"><TSelect t={t} disabled={!canAdjust} value={adjForm.productId} onChange={e => setAdjForm(f => ({ ...f, productId: e.target.value }))}>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</TSelect></Field>
            <Field t={t} label="Direction"><TSelect t={t} disabled={!canAdjust} value={adjForm.direction} onChange={e => setAdjForm(f => ({ ...f, direction: e.target.value }))}><option>Increase</option><option>Decrease</option><option>Damage</option></TSelect></Field>
            <Field t={t} label="Quantity"><TInput t={t} disabled={!canAdjust} type="number" value={adjForm.qty} onChange={e => setAdjForm(f => ({ ...f, qty: +e.target.value }))} /></Field>
            <Btn t={t} variant="primary" disabled={!canAdjust} onClick={submitAdjustment}>Apply Adjustment</Btn>
          </div>
          <div className="mt-3"><Field t={t} label="Reason (mandatory)"><TInput t={t} disabled={!canAdjust} value={adjForm.reason} onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Physical count correction, warehouse damage…" /></Field></div>
          <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
            <h4 className="text-sm font-semibold mb-2">Adjustment History</h4>
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{['Date', 'Product', 'Change', 'Reference', 'User'].map(h => <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>)}</tr></thead>
              <tbody>
                {movements.filter(m => m.type.startsWith('Adjustment')).map(m => (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td className="px-3 py-2 text-xs">{m.date}</td>
                    <td className="px-3 py-2">{products.find(p => p.id === m.productId)?.name}</td>
                    <td className="px-3 py-2" style={{ color: m.qtyChange >= 0 ? t.success : t.danger }}>{m.qtyChange >= 0 ? '+' : ''}{m.qtyChange}</td>
                    <td className="px-3 py-2 text-xs">{m.reference}</td>
                    <td className="px-3 py-2 text-xs">{m.user}</td>
                  </tr>
                ))}
                {movements.filter(m => m.type.startsWith('Adjustment')).length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-sm" style={{ color: t.textFaint }}>No adjustments recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'history' && (
        <Card t={t} className="p-4">
          <ProductMovementHistory t={t} products={products} movements={movements} />
        </Card>
      )}

      {tab === 'valuation' && (
        <Card t={t} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Stock Valuation by Category</h3>
            <Btn t={t} variant="secondary" icon={Download} onClick={exportValuation}>Export CSV</Btn>
          </div>
          <table className="w-full text-sm mb-4">
            <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{['Category', 'Units', 'Value', '% of Total'].map(h => <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>)}</tr></thead>
            <tbody>
              {CATEGORIES.map(c => {
                const items = products.filter(p => p.category === c);
                const units = items.reduce((s, p) => s + p.stockQty, 0);
                const value = items.reduce((s, p) => s + p.stockQty * p.costPrice, 0);
                if (units === 0 && value === 0) return null;
                return <tr key={c} style={{ borderBottom: `1px solid ${t.border}` }}><td className="px-3 py-2">{c}</td><td className="px-3 py-2">{units}</td><td className="px-3 py-2">{fmt(value)}</td><td className="px-3 py-2">{totalValue ? ((value / totalValue) * 100).toFixed(1) : 0}%</td></tr>;
              })}
            </tbody>
          </table>
          <div className="text-right font-semibold text-base pt-2" style={{ borderTop: `1px solid ${t.border}` }}>Total Inventory Value: {money(totalValue, companyInfo.currency)}</div>
        </Card>
      )}

      {selected && <ProductDrilldown t={t} product={selected} onClose={() => setSelected(null)} movements={movements} sales={sales} purchaseOrders={purchaseOrders} suppliers={suppliers} returns={returns} companyInfo={companyInfo} />}
    </div>
  );
}

function ProductMovementHistory({ t, products, movements }) {
  const [productId, setProductId] = useState(products[0]?.id);
  const product = products.find(p => p.id === +productId);
  const list = movements.filter(m => m.productId === +productId).slice().reverse();
  let running = 0;
  const rows = list.map(m => { running += m.qtyChange; return { ...m, running }; });
  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold text-sm" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Stock Movement History</h3>
        <TSelect t={t} value={productId} onChange={e => setProductId(e.target.value)} style={{ width: 240 }}>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</TSelect>
      </div>
      <p className="text-xs mb-3" style={{ color: t.textMuted }}>Opening balance → Stock-In → Stock-Out → Returns → Adjustments → Current balance ({product?.stockQty} units)</p>
      <table className="w-full text-sm">
        <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{['Date', 'Type', 'Change', 'Running Balance', 'Reference', 'User'].map(h => <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(m => (
            <tr key={m.id} style={{ borderBottom: `1px solid ${t.border}` }}>
              <td className="px-3 py-2 text-xs">{m.date}</td>
              <td className="px-3 py-2"><Badge t={t} tone={m.qtyChange >= 0 ? 'success' : 'danger'}>{m.type}</Badge></td>
              <td className="px-3 py-2" style={{ color: m.qtyChange >= 0 ? t.success : t.danger }}>{m.qtyChange >= 0 ? '+' : ''}{m.qtyChange}</td>
              <td className="px-3 py-2 font-medium">{m.running}</td>
              <td className="px-3 py-2 text-xs" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{m.reference}</td>
              <td className="px-3 py-2 text-xs">{m.user}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm" style={{ color: t.textFaint }}>No movements recorded for this product.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ProductDrilldown({ t, product, onClose, movements, sales, purchaseOrders, suppliers, returns, companyInfo }) {
  const status = productStatus(product);
  const supplier = suppliers.find(s => s.id === product.primarySupplierId);
  const productMovements = movements.filter(m => m.productId === product.id);
  const stockIn = productMovements.filter(m => ['Purchase', 'Return-In'].includes(m.type));
  const stockOut = productMovements.filter(m => m.qtyChange < 0);
  const salesHistory = sales.filter(s => s.items.some(i => i.productId === product.id));
  const purchaseHistory = purchaseOrders.filter(po => po.items.some(i => +i.productId === product.id));
  const productReturns = returns.filter(r => r.productId === product.id);
  const adjustments = productMovements.filter(m => m.type.startsWith('Adjustment'));

  return (
    <Modal t={t} title="Product Inventory Profile" onClose={onClose} wide>
      <div className="flex items-start gap-4 mb-4 flex-wrap">
        <ProductThumb t={t} product={product} size={64} rounded="rounded-lg" />
        <div className="flex-1 min-w-[200px]">
          <h3 className="font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{product.name}</h3>
          <p className="text-xs flex items-center gap-1" style={{ color: t.textFaint, fontFamily: "'JetBrains Mono',monospace" }}><QrCode size={12} /> {product.sku} · {product.partNumber} · {product.barcode}</p>
          <p className="text-xs mt-1" style={{ color: t.textMuted }}>{product.category} · {product.brand} · Compatible: {product.compatibility}</p>
        </div>
        <div className="text-right">
          <Badge t={t} tone={statusTone(status)}>{status}</Badge>
          <div className="text-lg font-semibold mt-1">{product.stockQty} units</div>
          <div className="text-xs" style={{ color: t.textFaint }}>{money(product.stockQty * product.costPrice, companyInfo.currency)} value</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-xs">
        <div className="p-2 rounded" style={{ background: t.surfaceAlt }}><div style={{ color: t.textFaint }}>Min / Max</div><div className="font-medium">{product.reorderLevel} / {product.maxStock}</div></div>
        <div className="p-2 rounded" style={{ background: t.surfaceAlt }}><div style={{ color: t.textFaint }}>Cost / Sell</div><div className="font-medium">{fmt(product.costPrice)} / {fmt(product.sellPrice)}</div></div>
        <div className="p-2 rounded" style={{ background: t.surfaceAlt }}><div style={{ color: t.textFaint }}>Location</div><div className="font-medium">{product.location}</div></div>
        <div className="p-2 rounded" style={{ background: t.surfaceAlt }}><div style={{ color: t.textFaint }}>Primary Supplier</div><div className="font-medium">{supplier?.name || '—'}</div></div>
      </div>

      <DrilldownSection t={t} title={`Stock-In History (${stockIn.length})`}>
        {stockIn.map(m => <DrillRow key={m.id} t={t} left={m.date} mid={`${m.type} · ${m.reference}`} right={`+${m.qtyChange}`} tone="success" />)}
        {stockIn.length === 0 && <EmptyRow t={t} />}
      </DrilldownSection>

      <DrilldownSection t={t} title={`Stock-Out History (${stockOut.length})`}>
        {stockOut.map(m => <DrillRow key={m.id} t={t} left={m.date} mid={`${m.type} · ${m.reference}`} right={`${m.qtyChange}`} tone="danger" />)}
        {stockOut.length === 0 && <EmptyRow t={t} />}
      </DrilldownSection>

      <DrilldownSection t={t} title={`Sales History (${salesHistory.length})`}>
        {salesHistory.map(s => { const line = s.items.find(i => i.productId === product.id); return <DrillRow key={s.id} t={t} left={s.date} mid={`${s.invoiceNo} · ${s.customerName}`} right={fmt(line.qty * line.price)} tone="steel" />; })}
        {salesHistory.length === 0 && <EmptyRow t={t} />}
      </DrilldownSection>

      <DrilldownSection t={t} title={`Purchase History (${purchaseHistory.length})`}>
        {purchaseHistory.map(po => <DrillRow key={po.id} t={t} left={po.date} mid={`${po.poNo} · ${po.supplierName}`} right={po.status} tone="steel" />)}
        {purchaseHistory.length === 0 && <EmptyRow t={t} />}
      </DrilldownSection>

      <DrilldownSection t={t} title={`Returns (${productReturns.length})`}>
        {productReturns.map(r => <DrillRow key={r.id} t={t} left={r.date} mid={`${r.refNo} · ${r.type} · ${r.condition}`} right={`${r.qty} units`} tone="warning" />)}
        {productReturns.length === 0 && <EmptyRow t={t} />}
      </DrilldownSection>

      <DrilldownSection t={t} title={`Adjustments (${adjustments.length})`}>
        {adjustments.map(m => <DrillRow key={m.id} t={t} left={m.date} mid={m.reference} right={`${m.qtyChange >= 0 ? '+' : ''}${m.qtyChange}`} tone={m.qtyChange >= 0 ? 'success' : 'danger'} />)}
        {adjustments.length === 0 && <EmptyRow t={t} />}
      </DrilldownSection>
    </Modal>
  );
}

function DrilldownSection({ t, title, children }) {
  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: t.textFaint }}>{title}</h4>
      <div className="rounded-md overflow-hidden max-h-32 overflow-y-auto" style={{ border: `1px solid ${t.border}` }}>{children}</div>
    </div>
  );
}
function DrillRow({ t, left, mid, right, tone }) {
  const toneColor = { success: t.success, danger: t.danger, warning: t.warning, steel: t.steel }[tone] || t.text;
  return (
    <div className="flex items-center justify-between px-3 py-2 text-xs" style={{ borderBottom: `1px solid ${t.border}` }}>
      <span style={{ color: t.textFaint }} className="shrink-0">{left}</span>
      <span className="flex-1 px-3 truncate">{mid}</span>
      <span style={{ color: toneColor }} className="font-medium shrink-0">{right}</span>
    </div>
  );
}
function EmptyRow({ t }) { return <div className="px-3 py-3 text-xs text-center" style={{ color: t.textFaint }}>No records.</div>; }

/* ============================== STOCK MANAGEMENT ============================== */
/**
 * Pure function: derives opening/in/out/closing stock and sales figures for one product
 * over a date range, entirely from the real stock ledger (`movements`) — no approximation.
 * Opening stock = the running balance recorded on the last movement strictly before the
 * range starts (0 if the product has no earlier history). Closing stock is then always
 * openingStock + stockIn - stockOut, so it can never drift from what actually happened.
 */
function computeStockRow(product, movements, dateFrom, dateTo) {
  const rangeStartKey = `${dateFrom} 00:00`;
  const rangeEndKey = `${dateTo} 23:59`;
  const productMovements = movements.filter(m => m.productId === product.id);

  const before = productMovements.filter(m => m.date < rangeStartKey).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const inRange = productMovements.filter(m => m.date >= rangeStartKey && m.date <= rangeEndKey);

  const openingStock = before.length ? before[before.length - 1].balanceAfter : 0;
  const stockIn = inRange.filter(m => m.qtyChange > 0).reduce((s, m) => s + m.qtyChange, 0);
  const stockOut = inRange.filter(m => m.qtyChange < 0).reduce((s, m) => s + Math.abs(m.qtyChange), 0);
  const closingStock = openingStock + stockIn - stockOut;
  const unitsSold = inRange.filter(m => m.type === 'Sale').reduce((s, m) => s + Math.abs(m.qtyChange), 0);
  const costOfSales = unitsSold * product.costPrice;
  const totalSales = unitsSold * product.sellPrice;
  const grossProfit = totalSales - costOfSales;

  return { openingStock, stockIn, stockOut, closingStock, unitsSold, costOfSales, totalSales, grossProfit };
}

function StockManagement({ t, products, setProducts, movements, addMovement, companyInfo, role, notify, logAudit }) {
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [dateTo, setDateTo] = useState(todayStr());
  const [editingProduct, setEditingProduct] = useState(null);
  const canEditPrices = ['Admin', 'Manager', 'Inventory'].includes(role);

  // Safety net required by design: every product must have at least one recorded movement
  // so this report is always built from real history, never a guess. In normal use every
  // product already gets an Opening Stock entry when created — this only fires for the
  // edge case where one is somehow missing.
  useEffect(() => {
    products.forEach(p => {
      if (!movements.some(m => m.productId === p.id)) {
        addMovement(p.id, 'Opening Stock', p.stockQty, 'OPEN-BACKFILL');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length]);

  const rows = products.map(p => ({ product: p, ...computeStockRow(p, movements, dateFrom, dateTo) }));
  const totals = rows.reduce((acc, r) => ({
    stockIn: acc.stockIn + r.stockIn, stockOut: acc.stockOut + r.stockOut,
    costOfSales: acc.costOfSales + r.costOfSales, totalSales: acc.totalSales + r.totalSales, grossProfit: acc.grossProfit + r.grossProfit,
  }), { stockIn: 0, stockOut: 0, costOfSales: 0, totalSales: 0, grossProfit: 0 });

  // Reuses the same edit + audit-log mechanism as the Products & Inventory page — the
  // closest existing "logged correction" flow in the app for a price change. Closing stock
  // is never part of this form; it's computed above and only ever rendered as text.
  const savePriceEdit = async (form) => {
    try {
      const { product } = await api.updateProduct(form.id, { ...form, expectedUpdatedAt: form.updatedAt });
      const mapped = productFromApi(product);
      const old = products.find(p => p.id === form.id);
      setProducts(prev => prev.map(p => p.id === mapped.id ? mapped : p));
      logAudit({
        action: `Edited ${mapped.name} pricing via Stock Management`, module: 'Stock Management',
        before: `Cost: ${fmt(old.costPrice)} / Sell: ${fmt(old.sellPrice)}`,
        after: `Cost: ${fmt(mapped.costPrice)} / Sell: ${fmt(mapped.sellPrice)}`,
      });
      notify(`${mapped.name} pricing updated.`);
      setEditingProduct(null);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const exportCSV = () => downloadCSV('stock-management.csv', [
    ['Product ID', 'Name', 'Category', 'Qty', 'Opening Stock', 'Stock In', 'Stock Out', 'Cost Price', 'Selling Price', 'Cost of Sales', 'Total Sales', 'Gross Profit', 'Closing Stock'],
    ...rows.map(r => [r.product.sku, r.product.name, r.product.category, r.product.stockQty, r.openingStock, r.stockIn, r.stockOut, r.product.costPrice, r.product.sellPrice, r.costOfSales, r.totalSales, r.grossProfit, r.closingStock]),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Stock Management</h1>
          <p className="text-sm" style={{ color: t.textMuted }}>Opening, movement, and closing stock reconciled from the real stock ledger for the selected period.</p>
        </div>
        <Btn t={t} variant="secondary" icon={Download} onClick={exportCSV}>Export CSV</Btn>
      </div>

      <Card t={t} className="p-4 flex flex-wrap items-end gap-3">
        <Field t={t} label="From"><TInput t={t} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></Field>
        <Field t={t} label="To"><TInput t={t} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></Field>
        {!canEditPrices && <span className="text-xs" style={{ color: t.textFaint }}>Your role can view this report but not edit pricing.</span>}
      </Card>

      <Card t={t} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
              {['Product ID', 'Product', 'Category', 'Qty', 'Opening', 'Stock In', 'Stock Out', 'Cost Price', 'Selling Price', 'Cost of Sales', 'Total Sales', 'Gross Profit', 'Closing Stock'].map(h => (
                <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap" style={{ color: t.textFaint, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const p = r.product;
              const mismatch = dateTo >= todayStr() && r.closingStock !== p.stockQty;
              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td className="px-3 py-2" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{p.sku}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{p.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.category}</td>
                  <td className="px-3 py-2">{p.stockQty}</td>
                  <td className="px-3 py-2">{fmt(r.openingStock)}</td>
                  <td className="px-3 py-2" style={{ color: t.success }}>{r.stockIn > 0 ? `+${fmt(r.stockIn)}` : '0'}</td>
                  <td className="px-3 py-2" style={{ color: t.danger }}>{r.stockOut > 0 ? `-${fmt(r.stockOut)}` : '0'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">{fmt(p.costPrice)}{canEditPrices && <button onClick={() => setEditingProduct(p)} title="Edit pricing"><Pencil size={12} style={{ color: t.textFaint }} /></button>}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">{fmt(p.sellPrice)}{canEditPrices && <button onClick={() => setEditingProduct(p)} title="Edit pricing"><Pencil size={12} style={{ color: t.textFaint }} /></button>}</div>
                  </td>
                  <td className="px-3 py-2">{fmt(r.costOfSales)}</td>
                  <td className="px-3 py-2">{fmt(r.totalSales)}</td>
                  <td className="px-3 py-2" style={{ color: r.grossProfit >= 0 ? t.success : t.danger }}>{fmt(r.grossProfit)}</td>
                  <td className="px-3 py-2 font-medium">
                    <div className="flex items-center gap-1.5">
                      {fmt(r.closingStock)}
                      {mismatch && <span title={`Ledger closing stock (${r.closingStock}) does not match current stock (${p.stockQty}) — check for an unrecorded movement.`}><AlertTriangle size={13} style={{ color: t.warning }} /></span>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={13} className="px-3 py-8 text-center text-sm" style={{ color: t.textFaint }}>No products to report on.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: `2px solid ${t.border}` }}>
                <td colSpan={5} className="px-3 py-2 text-right font-semibold text-xs" style={{ color: t.textFaint }}>TOTALS</td>
                <td className="px-3 py-2 font-semibold" style={{ color: t.success }}>+{fmt(totals.stockIn)}</td>
                <td className="px-3 py-2 font-semibold" style={{ color: t.danger }}>-{fmt(totals.stockOut)}</td>
                <td colSpan={2}></td>
                <td className="px-3 py-2 font-semibold">{fmt(totals.costOfSales)}</td>
                <td className="px-3 py-2 font-semibold">{fmt(totals.totalSales)}</td>
                <td className="px-3 py-2 font-semibold" style={{ color: totals.grossProfit >= 0 ? t.success : t.danger }}>{fmt(totals.grossProfit)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>

      {editingProduct && canEditPrices && (
        <ProductModal t={t} initial={editingProduct} isNew={false} onClose={() => setEditingProduct(null)} onSave={savePriceEdit} />
      )}
    </div>
  );
}
