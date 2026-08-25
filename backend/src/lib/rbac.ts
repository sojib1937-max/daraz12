// Role-based access control — permission keys enforced by middleware on the
// backend. Never rely on the frontend hiding buttons for security.
import { AdminRole } from '@prisma/client';

export const PERMISSIONS: Record<string, { description: string; group: string }> = {
  'dashboard.view': { description: 'View dashboard and analytics', group: 'Dashboard' },
  'orders.view': { description: 'View orders', group: 'Orders' },
  'orders.create': { description: 'Create orders', group: 'Orders' },
  'orders.update': { description: 'Update orders (status, notes, courier)', group: 'Orders' },
  'orders.delete': { description: 'Delete orders', group: 'Orders' },
  'orders.export': { description: 'Export orders (CSV/Excel)', group: 'Orders' },
  'customers.view': { description: 'View customers', group: 'Customers' },
  'customers.update': { description: 'Edit customers and notes', group: 'Customers' },
  'customers.export': { description: 'Export customers', group: 'Customers' },
  'products.view': { description: 'View products', group: 'Products' },
  'products.create': { description: 'Create products', group: 'Products' },
  'products.update': { description: 'Edit products', group: 'Products' },
  'products.delete': { description: 'Delete products', group: 'Products' },
  'products.import': { description: 'Import / export products', group: 'Products' },
  'categories.manage': { description: 'Manage categories and brands', group: 'Catalog' },
  'coupons.manage': { description: 'Manage coupons', group: 'Marketing' },
  'flashsales.manage': { description: 'Manage flash sales', group: 'Marketing' },
  'reviews.manage': { description: 'Moderate reviews', group: 'Marketing' },
  'media.manage': { description: 'Manage media library', group: 'Content' },
  'homepage.manage': { description: 'Manage homepage sections', group: 'Content' },
  'settings.view': { description: 'View settings', group: 'Settings' },
  'settings.update': { description: 'Update settings', group: 'Settings' },
  'shipping.manage': { description: 'Manage shipping zones and rules', group: 'Settings' },
  'admin.manage': { description: 'Manage admin users and roles', group: 'Admin' },
  'audit.view': { description: 'View audit log', group: 'Admin' },
  'notifications.view': { description: 'View notifications', group: 'Admin' },
  'analytics.view': { description: 'View analytics', group: 'Analytics' },
  'carts.view': { description: 'View abandoned carts', group: 'Analytics' },
};

const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  SUPER_ADMIN: Object.keys(PERMISSIONS),
  ADMIN: Object.keys(PERMISSIONS).filter((p) => !p.startsWith('admin.')),
  MANAGER: [
    'dashboard.view', 'orders.view', 'orders.update', 'orders.export',
    'customers.view', 'customers.update', 'products.view', 'products.create', 'products.update',
    'categories.manage', 'coupons.manage', 'flashsales.manage', 'reviews.manage',
    'media.manage', 'homepage.manage', 'settings.view', 'shipping.manage',
    'notifications.view', 'analytics.view', 'carts.view',
  ],
  ORDER_MANAGER: [
    'dashboard.view', 'orders.view', 'orders.update', 'orders.export', 'customers.view',
    'notifications.view', 'carts.view',
  ],
  PRODUCT_MANAGER: [
    'dashboard.view', 'products.view', 'products.create', 'products.update', 'products.delete', 'products.import',
    'categories.manage', 'media.manage', 'flashsales.manage', 'notifications.view',
  ],
  VIEWER: ['dashboard.view', 'orders.view', 'customers.view', 'products.view', 'settings.view', 'audit.view', 'analytics.view', 'notifications.view'],
};

export function rolePermissions(role: AdminRole): string[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(role: AdminRole | undefined, permission: string): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(permission: string) {
  return (_req: unknown, res: { locals: { admin?: { role: AdminRole } } }, next: (err?: unknown) => void) => {
    const admin = res.locals.admin;
    if (!admin || !hasPermission(admin.role, permission)) {
      return next(new Error('FORBIDDEN'));
    }
    next();
  };
}

export const ROLES: { value: AdminRole; label: string; description: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', description: 'Full control, including admin users and audit log' },
  { value: 'ADMIN', label: 'Admin', description: 'Most store functions except admin-user management' },
  { value: 'MANAGER', label: 'Manager', description: 'Daily operations: orders, products, marketing' },
  { value: 'ORDER_MANAGER', label: 'Order Manager', description: 'Orders, customers, notifications only' },
  { value: 'PRODUCT_MANAGER', label: 'Product Manager', description: 'Products, categories, media, flash sales' },
  { value: 'VIEWER', label: 'Viewer', description: 'Read-only access' },
];
