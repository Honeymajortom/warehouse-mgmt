export const MODULES = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'customers', label: 'Customers', icon: '👥' },
  { key: 'vendors', label: 'Vendors', icon: '🏭' },
  { key: 'products', label: 'Products', icon: '📦' },
  { key: 'purchase', label: 'Purchase Orders', icon: '🛒' },
  { key: 'grn', label: 'GRN', icon: '📋' },
  { key: 'putaway', label: 'Put-Away', icon: '🏗️' },
  { key: 'inventory', label: 'Inventory', icon: '🗃️' },
  { key: 'picking', label: 'Picking', icon: '⛏️' },
  { key: 'packing', label: 'Packing', icon: '📤' },
  { key: 'returns', label: 'Returns', icon: '↩️' },
  { key: 'reports', label: 'Reports', icon: '📈' },
];

export const ACTIONS = ['view', 'create', 'edit', 'execute', 'approve', 'export'];

export const ROLE_COLORS = {
  admin: { bg: 'var(--badge-purple-bg)', text: 'var(--badge-purple-fg)', border: 'var(--badge-purple-br)' },
  operator: { bg: 'var(--badge-blue-bg)', text: 'var(--badge-blue-fg)', border: 'var(--badge-blue-br)' },
  viewer: { bg: 'var(--badge-gray-bg)', text: 'var(--badge-gray-fg)', border: 'var(--badge-gray-br)' },
};

export const STATUS_COLORS = {
  approved: { bg: 'var(--badge-green-bg)', text: 'var(--badge-green-fg)', border: 'var(--badge-green-br)' },
  pending: { bg: 'var(--badge-amber-bg)', text: 'var(--badge-amber-fg)', border: 'var(--badge-amber-br)' },
  rejected: { bg: 'var(--badge-red-bg)', text: 'var(--badge-red-fg)', border: 'var(--badge-red-br)' },
};