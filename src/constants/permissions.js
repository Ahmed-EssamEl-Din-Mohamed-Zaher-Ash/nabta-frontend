// Source of truth for roles & permissions.
// Ported VERBATIM from legacy-app.js (lines 7–45) — do not "improve" values here
// without changing the backend authorization rules to match.

export const ROLE_LABELS = {
  admin: 'مدير النظام',
  sales: 'مهندس مبيعات',
  account: 'أكاونت مانجر',
  ops: 'عمليات وتوصيل',
  finance: 'محاسبة',
  driver: 'سائق',
};

export const STATUS_LABELS = {
  new: 'جديد',
  confirmed: 'مؤكد',
  preparing: 'جاري التحضير',
  ready: 'جاهز للتوصيل',
  out: 'في الطريق',
  delivered: 'تم التسليم',
  failed: 'فشل التسليم',
  paid: 'تم الدفع للمورد',
};

// Which role may advance an order from a given status, and to what.
export const STATUS_FLOW = {
  new: { next: 'confirmed', label: 'تأكيد الأوردر', roles: ['sales', 'admin'] },
  confirmed: { next: 'preparing', label: 'بدء التحضير', roles: ['account', 'admin'] },
  preparing: { next: 'ready', label: 'جاهز للتوصيل', roles: ['account', 'admin'] },
  ready: { next: 'out', label: 'إرسال للتوصيل', roles: ['ops', 'admin'] },
  out: { next: 'delivered', label: 'تم التسليم', roles: ['ops', 'admin'] },
  delivered: { next: 'paid', label: 'تم الدفع للمورد', roles: ['finance', 'admin'] },
  paid: { next: null, label: null, roles: [] },
};

// Which order statuses each role sees in the orders list.
export const ROLE_STATUS_FILTER = {
  admin: ['new', 'confirmed', 'preparing', 'ready', 'out', 'delivered', 'failed', 'paid'],
  sales: ['new', 'confirmed'],
  account: ['confirmed', 'preparing', 'ready'],
  ops: ['ready', 'out', 'delivered', 'failed'],
  finance: ['delivered', 'paid'],
  driver: ['out', 'delivered'],
};

// Roles allowed to call GET /api/reports/* — mirrors authorizeRoles(...) on
// the reports routes in backend/src/server.ts; keep the two lists in sync.
export const REPORT_ROLES = ['admin', 'finance', 'sales', 'account'];

// Which pages each role can open (drives both the sidebar and route guards).
export const ROLE_PAGES = {
  admin: ['dashboard', 'orders', 'add-order', 'products', 'vendors', 'customers', 'drivers', 'vehicles', 'routes', 'tracking-map', 'analytics', 'cycle-audit', 'users'],
  sales: ['dashboard', 'orders', 'add-order', 'products', 'customers'],
  account: ['dashboard', 'orders', 'vendors'],
  ops: ['dashboard', 'orders', 'drivers', 'vehicles', 'routes', 'tracking-map'],
  finance: ['dashboard', 'orders', 'vendors'],
  driver: ['dashboard', 'orders', 'driver-tracking'],
};

// Sidebar metadata, in legacy display order (object key order matters).
export const NAV_ITEMS = {
  dashboard: { label: 'الرئيسية', icon: 'home', section: 'رئيسي' },
  orders: { label: 'الأوردرات', icon: 'orders', section: 'رئيسي' },
  'add-order': { label: 'إضافة أوردر', icon: 'plus', section: 'رئيسي' },
  products: { label: 'المنتجات', icon: 'products', section: 'بيانات' },
  vendors: { label: 'الموردون', icon: 'vendor', section: 'بيانات' },
  customers: { label: 'العملاء', icon: 'customers', section: 'بيانات' },
  drivers: { label: 'السائقون', icon: 'driver', section: 'لوجستيات' },
  vehicles: { label: 'المركبات', icon: 'vehicle', section: 'لوجستيات' },
  routes: { label: 'المسارات', icon: 'route', section: 'لوجستيات' },
  'tracking-map': { label: 'خريطة التتبع', icon: 'map', section: 'لوجستيات' },
  'driver-tracking': { label: 'تتبع السائق الحي', icon: 'vehicle', section: 'لوجستيات' },
  analytics: { label: 'التحليلات', icon: 'chart', section: 'تقارير' },
  'cycle-audit': { label: 'مراجعة الدورة', icon: 'rotate', section: 'تقارير' },
  users: { label: 'المستخدمين / الصلاحيات', icon: 'customers', section: 'الإدارة' },
};

/** Can `role` open `page`? */
export function canAccessPage(role, page) {
  return Boolean(role && ROLE_PAGES[role]?.includes(page));
}

/** The status-advance action available to `role` for an order in `status`, or null. */
export function getStatusAction(role, status) {
  const flow = STATUS_FLOW[status];
  if (!flow || !flow.next || !flow.roles.includes(role)) return null;
  return { next: flow.next, label: flow.label };
}
