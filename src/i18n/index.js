import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Bilingual (ar/en) foundation. The app chrome (sidebar, header, roles/status,
// common actions) is keyed here; page bodies migrate to these keys incrementally.
// Switching language also flips the document direction (rtl/ltr).

const resources = {
  ar: {
    translation: {
      brand: { name: 'نبتة', subtitle: 'إدارة الطلبات' },
      logout: 'تسجيل الخروج',
      user: 'المستخدم',
      switchLang: 'English',
      common: { add: 'إضافة', edit: 'تعديل', delete: 'حذف', save: 'حفظ', cancel: 'إلغاء', view: 'عرض', export: 'تصدير', actions: 'إجراءات', search: 'بحث', loading: 'جارٍ التحميل…', noData: 'لا توجد بيانات' },
      nav: {
        dashboard: 'الرئيسية', orders: 'الطلبات', 'add-order': 'إضافة طلب', products: 'المنتجات',
        offers: 'العروض والخصومات', vendors: 'الموردون', customers: 'العملاء', drivers: 'السائقون',
        vehicles: 'المركبات', routes: 'المسارات', 'tracking-map': 'خريطة التتبع', 'driver-tracking': 'تتبع السائق الحي',
        analytics: 'التحليلات', finance: 'القسم المالي', 'cycle-audit': 'مراجعة الدورة', users: 'المستخدمين / الصلاحيات',
      },
      sections: { 'رئيسي': 'رئيسي', 'بيانات': 'بيانات', 'لوجستيات': 'لوجستيات', 'تقارير': 'تقارير', 'الإدارة': 'الإدارة' },
      roles: { admin: 'مدير النظام', sales: 'مهندس مبيعات', account: 'مدير الحسابات', ops: 'عمليات وتوصيل', finance: 'محاسبة', driver: 'سائق' },
      status: { new: 'جديد', confirmed: 'مؤكد', preparing: 'جاري التحضير', ready: 'جاهز للتوصيل', out: 'في الطريق', delivered: 'تم التسليم', failed: 'فشل التسليم', paid: 'تم الدفع للمورد' },
      lang: { ar: 'العربية', en: 'الإنجليزية' },
    },
  },
  en: {
    translation: {
      brand: { name: 'Nabta', subtitle: 'Order Management' },
      logout: 'Logout',
      user: 'User',
      switchLang: 'العربية',
      common: { add: 'Add', edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel', view: 'View', export: 'Export', actions: 'Actions', search: 'Search', loading: 'Loading…', noData: 'No data' },
      nav: {
        dashboard: 'Dashboard', orders: 'Orders', 'add-order': 'Add Order', products: 'Products',
        offers: 'Offers & Discounts', vendors: 'Vendors', customers: 'Customers', drivers: 'Drivers',
        vehicles: 'Vehicles', routes: 'Routes', 'tracking-map': 'Tracking Map', 'driver-tracking': 'Live Driver Tracking',
        analytics: 'Analytics', finance: 'Finance', 'cycle-audit': 'Cycle Audit', users: 'Users / Roles',
      },
      sections: { 'رئيسي': 'Main', 'بيانات': 'Data', 'لوجستيات': 'Logistics', 'تقارير': 'Reports', 'الإدارة': 'Administration' },
      roles: { admin: 'System Admin', sales: 'Sales Engineer', account: 'Account Manager', ops: 'Operations', finance: 'Accounting', driver: 'Driver' },
      status: { new: 'New', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready', out: 'Out for delivery', delivered: 'Delivered', failed: 'Failed', paid: 'Paid to vendor' },
      lang: { ar: 'Arabic', en: 'English' },
    },
  },
};

const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('nabta_lang')) || 'ar';

function applyDir(lng) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
}

i18n.use(initReactI18next).init({
  resources,
  lng: saved,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
});

applyDir(saved);
i18n.on('languageChanged', (lng) => {
  applyDir(lng);
  try { localStorage.setItem('nabta_lang', lng); } catch { /* ignore */ }
});

export default i18n;
