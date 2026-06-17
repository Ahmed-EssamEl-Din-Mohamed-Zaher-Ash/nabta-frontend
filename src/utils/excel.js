import * as XLSX from 'xlsx';
import { STATUS_LABELS } from '../constants/permissions.js';

// Ported from legacy exportByRole + helpers. Column names match the legacy
// sheets exactly. Orders come from /api/orders WITH includes (customer,
// vendor, driver, vehicle, route, items.product).

const fmtDate = (d) => (d ? String(d).slice(0, 10) : '-');
const fmtNum = (n) => Math.round((Number(n) || 0) * 100) / 100;
const subtotalOf = (o) => (o.items || []).reduce((s, it) => s + it.qty * it.price, 0);
// Multi-vendor: an order may span several vendors (o.vendors[]). Fall back to
// the legacy single vendor. (Per-vendor financial aggregation is handled by the
// finance module, which splits at the item level.)
const vName = (o) => {
  const vs = o.vendors && o.vendors.length ? o.vendors : o.vendor ? [o.vendor] : [];
  return vs.length ? vs.map((v) => v.nameAr || v.name).join('، ') : '-';
};
const totalOf = (o) => {
  const sub = subtotalOf(o);
  return sub + sub * ((o.taxRate ?? 5) / 100) + (o.deliveryFee || 0);
};

function setColWidths(ws, widths) {
  ws['!cols'] = widths.map((wch) => ({ wch }));
}

function addSheet(wb, ws, name) {
  XLSX.utils.book_append_sheet(wb, ws, name);
}

function downloadWb(wb, filename) {
  XLSX.writeFile(wb, filename);
}

const today = () => new Date().toISOString().slice(0, 10);

// ── 1. SALES ────────────────────────────────────────────────────
export function exportSalesExcel(orders) {
  const rows1 = orders.map((o) => {
    const sub = subtotalOf(o);
    const tax = sub * ((o.taxRate ?? 5) / 100);
    const del = o.deliveryFee || 0;
    return {
      'رقم الأوردر': o.orderNumber,
      'تاريخ الإنشاء': fmtDate(o.date),
      'العميل': o.customer?.name || '-',
      'هاتف العميل': o.customer?.phone || '-',
      'عنوان التسليم': o.deliveryAddress || '-',
      'المورد': vName(o),
      'عدد المنتجات': (o.items || []).length,
      'المجموع الجزئي': fmtNum(sub),
      'ضريبة القيمة المضافة 5%': fmtNum(tax),
      'رسوم التوصيل': fmtNum(del),
      'الإجمالي الكلي': fmtNum(sub + tax + del),
      'الحالة': STATUS_LABELS[o.status] || o.status,
      'تاريخ التأكيد': fmtDate(o.confirmedAt),
      'ملاحظات': o.notes || '-',
    };
  });

  const rows2 = [];
  orders.forEach((o) => {
    (o.items || []).forEach((it) => {
      rows2.push({
        'رقم الأوردر': o.orderNumber,
        'تاريخ الأوردر': fmtDate(o.date),
        'اسم المنتج': it.product?.nameAr || it.product?.name || it.productId,
        'الكمية': it.qty,
        'الوحدة': it.product?.unit || '-',
        'سعر الوحدة': fmtNum(it.price),
        'إجمالي السطر': fmtNum(it.qty * it.price),
        'المورد': vName(o),
        'حالة الأوردر': STATUS_LABELS[o.status] || o.status,
      });
    });
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(rows1);
  setColWidths(ws1, [12, 12, 22, 14, 28, 20, 8, 14, 16, 12, 14, 14, 12, 24]);
  addSheet(wb, ws1, 'ملخص الأوردرات');
  const ws2 = XLSX.utils.json_to_sheet(rows2);
  setColWidths(ws2, [12, 12, 28, 8, 10, 12, 14, 20, 14]);
  addSheet(wb, ws2, 'تفاصيل المنتجات');
  downloadWb(wb, `nabta_sales_${today()}.xlsx`);
}

// ── 2. ACCOUNT MANAGER ──────────────────────────────────────────
export function exportAccountExcel(orders, vendors) {
  const rows1 = orders.map((o) => ({
    'رقم الأوردر': o.orderNumber,
    'تاريخ الأوردر': fmtDate(o.date),
    'العميل': o.customer?.name || '-',
    'المورد': vName(o),
    'هاتف المورد': o.vendor?.phone || '-',
    'بريد المورد': o.vendor?.email || '-',
    'المنتجات': (o.items || [])
      .map((it) => `${it.product?.nameAr || it.productId} (${it.qty})`)
      .join(' | '),
    'الإجمالي': fmtNum(totalOf(o)),
    'تاريخ التأكيد': fmtDate(o.confirmedAt),
    'تاريخ بدء التحضير': fmtDate(o.preparedAt),
    'تاريخ الجاهزية': fmtDate(o.readyAt),
    'الحالة الحالية': STATUS_LABELS[o.status] || o.status,
    'ملاحظات المورد': '-',
  }));

  const rows2 = vendors.map((v) => {
    const vOrders = orders.filter((o) => o.vendorId === v.id);
    return {
      'المورد': v.nameAr || v.name,
      'الهاتف': v.phone || '-',
      'إجمالي الأوردرات': vOrders.length,
      'القيمة الإجمالية': fmtNum(vOrders.reduce((s, o) => s + totalOf(o), 0)),
      'مؤكد': vOrders.filter((o) => o.status === 'confirmed').length,
      'قيد التحضير': vOrders.filter((o) => o.status === 'preparing').length,
      'جاهز للتسليم': vOrders.filter((o) => o.status === 'ready').length,
      'تم التسليم': vOrders.filter((o) => ['delivered', 'paid'].includes(o.status)).length,
      'شروط الدفع (يوم)': v.payoutTerms === 0 ? 'فوري' : `${v.payoutTerms} يوم`,
    };
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(rows1);
  setColWidths(ws1, [12, 12, 22, 20, 14, 24, 48, 12, 14, 16, 14, 16, 24]);
  addSheet(wb, ws1, 'أوردرات الموردين');
  const ws2 = XLSX.utils.json_to_sheet(rows2);
  setColWidths(ws2, [22, 14, 10, 14, 8, 12, 12, 10, 14]);
  addSheet(wb, ws2, 'ملخص الموردين');
  downloadWb(wb, `nabta_account_${today()}.xlsx`);
}

// ── 3. OPERATIONS ───────────────────────────────────────────────
export function exportOpsExcel(orders, drivers) {
  const rows1 = orders.map((o) => ({
    'رقم الأوردر': o.orderNumber,
    'تاريخ الأوردر': fmtDate(o.date),
    'العميل': o.customer?.name || '-',
    'هاتف العميل': o.customer?.phone || '-',
    'عنوان التسليم': o.deliveryAddress || '-',
    'الموقع (خط عرض)': o.location?.lat ?? '-',
    'الموقع (خط طول)': o.location?.lng ?? '-',
    'السائق': o.driver?.name || 'غير محدد',
    'هاتف السائق': o.driver?.phone || '-',
    'المركبة': o.vehicle?.plate || 'غير محددة',
    'نوع المركبة': o.vehicle?.model || '-',
    'المسار': o.route?.name || '-',
    'تاريخ الجاهزية': fmtDate(o.readyAt),
    'تاريخ الإرسال': fmtDate(o.dispatchedAt),
    'تاريخ التسليم': fmtDate(o.deliveredAt),
    'حالة التسليم': STATUS_LABELS[o.status] || o.status,
    'سبب الفشل': o.failureReason || '-',
  }));

  const rows2 = drivers.map((d) => {
    const dOrders = orders.filter((o) => o.driverId === d.id);
    const delivered = dOrders.filter((o) => o.status === 'delivered' || o.status === 'paid').length;
    const failed = dOrders.filter((o) => o.status === 'failed').length;
    const total = dOrders.length;
    return {
      'السائق': d.name,
      'الهاتف': d.phone || '-',
      'المركبة': d.vehicle?.plate || '-',
      'إجمالي الأوردرات': total,
      'تم التسليم': delivered,
      'فشل التسليم': failed,
      'قيد التنفيذ': dOrders.filter((o) => o.status === 'out').length,
      'معدل النجاح': total > 0 ? ((delivered / total) * 100).toFixed(0) + '%' : '-',
    };
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(rows1);
  setColWidths(ws1, [12, 12, 22, 14, 28, 12, 12, 18, 14, 14, 18, 16, 14, 14, 14, 16, 20]);
  addSheet(wb, ws1, 'أوردرات التوصيل');
  const ws2 = XLSX.utils.json_to_sheet(rows2.length ? rows2 : [{ 'لا يوجد بيانات': '-' }]);
  setColWidths(ws2, [22, 14, 14, 10, 10, 10, 10, 10]);
  addSheet(wb, ws2, 'أداء السائقين');
  downloadWb(wb, `nabta_operations_${today()}.xlsx`);
}

// ── 4. FINANCE ──────────────────────────────────────────────────
export function exportFinanceExcel(orders, vendors) {
  const delivered = orders.filter((o) => ['delivered', 'paid'].includes(o.status));

  const rows1 = delivered.map((o) => {
    const sub = subtotalOf(o);
    const tax = sub * ((o.taxRate ?? 5) / 100);
    const del = o.deliveryFee || 0;
    return {
      'رقم الأوردر': o.orderNumber,
      'تاريخ الأوردر': fmtDate(o.date),
      'تاريخ التسليم': fmtDate(o.deliveredAt),
      'العميل': o.customer?.name || '-',
      'المورد': vName(o),
      'المجموع الجزئي': fmtNum(sub),
      'ضريبة القيمة المضافة 5%': fmtNum(tax),
      'رسوم التوصيل': fmtNum(del),
      'الإجمالي الكلي': fmtNum(sub + tax + del),
      'حالة الدفع للمورد': o.status === 'paid' ? 'تم الدفع' : 'معلق',
      'تاريخ دفع المورد': fmtDate(o.paidAt),
      'إثبات التحويل': o.paymentProof || '-',
    };
  });

  const rows2 = vendors.map((v) => {
    const vDel = delivered.filter((o) => o.vendorId === v.id);
    const paid = vDel.filter((o) => o.status === 'paid');
    const pend = vDel.filter((o) => o.status === 'delivered');
    const totPend = pend.reduce((s, o) => s + totalOf(o), 0);
    let nextDue = '-';
    if (pend.length > 0) {
      const earliest = [...pend].sort((a, b) => new Date(a.deliveredAt) - new Date(b.deliveredAt))[0];
      if (earliest?.deliveredAt) {
        const d = new Date(earliest.deliveredAt);
        d.setDate(d.getDate() + (v.payoutTerms || 0));
        nextDue = d.toISOString().split('T')[0];
      }
    }
    return {
      'المورد': v.nameAr || v.name,
      'البنك': v.bankName || '-',
      'اسم صاحب الحساب': v.accountHolder || '-',
      'IBAN': v.iban || '-',
      'رقم الحساب': v.accountNumber || '-',
      'المبلغ المدفوع': fmtNum(paid.reduce((s, o) => s + totalOf(o), 0)),
      'المبلغ المعلق': fmtNum(totPend),
      'شروط الدفع (يوم)': v.payoutTerms === 0 ? 'فوري' : String(v.payoutTerms),
      'تاريخ الاستحقاق القادم': nextDue,
      'حالة الدفع': totPend > 0 ? 'يوجد معلق' : 'كل شيء محسوم',
    };
  });

  const allSub = delivered.reduce((s, o) => s + subtotalOf(o), 0);
  const allTax = delivered.reduce((s, o) => s + subtotalOf(o) * ((o.taxRate ?? 5) / 100), 0);
  const allDel = delivered.reduce((s, o) => s + (o.deliveryFee || 0), 0);
  const rows3 = [
    { 'البند': 'إجمالي المبيعات المسلّمة', 'المبلغ (د.إ)': fmtNum(allSub + allTax + allDel) },
    { 'البند': 'إجمالي المجاميع الجزئية', 'المبلغ (د.إ)': fmtNum(allSub) },
    { 'البند': 'ضريبة القيمة المضافة المحصّلة (5%)', 'المبلغ (د.إ)': fmtNum(allTax) },
    { 'البند': 'إجمالي رسوم التوصيل', 'المبلغ (د.إ)': fmtNum(allDel) },
    { 'البند': '---', 'المبلغ (د.إ)': '' },
    { 'البند': 'تم الدفع للموردين', 'المبلغ (د.إ)': fmtNum(orders.filter((o) => o.status === 'paid').reduce((s, o) => s + totalOf(o), 0)) },
    { 'البند': 'المعلق للموردين', 'المبلغ (د.إ)': fmtNum(orders.filter((o) => o.status === 'delivered').reduce((s, o) => s + totalOf(o), 0)) },
    { 'البند': '---', 'المبلغ (د.إ)': '' },
    { 'البند': 'عدد الأوردرات المسلّمة', 'المبلغ (د.إ)': delivered.length },
    { 'البند': 'عدد الأوردرات المدفوعة للمورد', 'المبلغ (د.إ)': orders.filter((o) => o.status === 'paid').length },
  ];

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(rows1);
  setColWidths(ws1, [12, 12, 14, 22, 22, 14, 18, 12, 14, 16, 14, 20]);
  addSheet(wb, ws1, 'فواتير المبيعات');
  const ws2 = XLSX.utils.json_to_sheet(rows2);
  setColWidths(ws2, [22, 22, 22, 32, 16, 14, 14, 14, 16, 18]);
  addSheet(wb, ws2, 'مدفوعات الموردين');
  const ws3 = XLSX.utils.json_to_sheet(rows3);
  setColWidths(ws3, [38, 16]);
  addSheet(wb, ws3, 'الملخص المالي');
  downloadWb(wb, `nabta_finance_${today()}.xlsx`);
}

// ── 5. ADMIN MASTER (6 sheets) ──────────────────────────────────
export function exportMasterExcel(orders, vendors, customers, drivers) {
  const wb = XLSX.utils.book_new();

  const allOrderRows = orders.map((o) => {
    const sub = subtotalOf(o);
    const tax = sub * ((o.taxRate ?? 5) / 100);
    return {
      'رقم الأوردر': o.orderNumber,
      'التاريخ': fmtDate(o.date),
      'العميل': o.customer?.name || '-',
      'هاتف العميل': o.customer?.phone || '-',
      'المورد': vName(o),
      'السائق': o.driver?.name || '-',
      'عنوان التسليم': o.deliveryAddress || '-',
      'المجموع الجزئي': fmtNum(sub),
      'الضريبة': fmtNum(tax),
      'رسوم التوصيل': fmtNum(o.deliveryFee || 0),
      'الإجمالي': fmtNum(sub + tax + (o.deliveryFee || 0)),
      'الحالة': STATUS_LABELS[o.status] || o.status,
      'تاريخ التأكيد': fmtDate(o.confirmedAt),
      'تاريخ التحضير': fmtDate(o.preparedAt),
      'تاريخ الجاهزية': fmtDate(o.readyAt),
      'تاريخ الإرسال': fmtDate(o.dispatchedAt),
      'تاريخ التسليم': fmtDate(o.deliveredAt),
      'تاريخ الدفع': fmtDate(o.paidAt),
      'إثبات الدفع': o.paymentProof || '-',
      'ملاحظات': o.notes || '-',
    };
  });
  const ws1 = XLSX.utils.json_to_sheet(allOrderRows);
  setColWidths(ws1, [12, 12, 22, 14, 20, 18, 28, 12, 10, 12, 12, 16, 12, 12, 12, 12, 12, 12, 16, 24]);
  addSheet(wb, ws1, 'جميع الأوردرات');

  const prodRows = [];
  orders.forEach((o) => {
    (o.items || []).forEach((it) => {
      prodRows.push({
        'رقم الأوردر': o.orderNumber,
        'المنتج': it.product?.nameAr || it.product?.name || it.productId,
        'الكمية': it.qty,
        'سعر الوحدة': fmtNum(it.price),
        'الإجمالي': fmtNum(it.qty * it.price),
        'المورد': vName(o),
      });
    });
  });
  const ws2 = XLSX.utils.json_to_sheet(prodRows.length ? prodRows : [{ 'لا يوجد بيانات': '-' }]);
  setColWidths(ws2, [12, 28, 8, 12, 12, 20]);
  addSheet(wb, ws2, 'تفاصيل المنتجات');

  const ws3 = XLSX.utils.json_to_sheet(
    vendors.map((v) => ({
      'المورد': v.nameAr || v.name,
      'الهاتف': v.phone || '-',
      'البريد': v.email || '-',
      'البنك': v.bankName || '-',
      'IBAN': v.iban || '-',
      'رقم الحساب': v.accountNumber || '-',
      'صاحب الحساب': v.accountHolder || '-',
      'شروط الدفع (يوم)': v.payoutTerms === 0 ? 'فوري' : String(v.payoutTerms),
    }))
  );
  setColWidths(ws3, [22, 14, 26, 22, 32, 16, 22, 14]);
  addSheet(wb, ws3, 'الموردون');

  const ws4 = XLSX.utils.json_to_sheet(
    customers.map((c) => ({
      'العميل': c.name,
      'الهاتف': c.phone || '-',
      'البريد': c.email || '-',
      'العنوان': c.address || '-',
      'ملاحظات': c.notes || '-',
    }))
  );
  setColWidths(ws4, [22, 14, 26, 32, 24]);
  addSheet(wb, ws4, 'العملاء');

  const drvRows = drivers.map((d) => ({
    'السائق': d.name,
    'الهاتف': d.phone || '-',
    'المركبة': d.vehicle?.plate || '-',
    'موديل المركبة': d.vehicle?.model || '-',
    'نوع المركبة': d.vehicle?.type || '-',
    'الحالة': d.status === 'active' ? 'نشط' : 'غير نشط',
  }));
  const ws5 = XLSX.utils.json_to_sheet(drvRows.length ? drvRows : [{ 'لا يوجد بيانات': '-' }]);
  setColWidths(ws5, [22, 14, 16, 20, 14, 10]);
  addSheet(wb, ws5, 'السائقون');

  const stages = ['new', 'confirmed', 'preparing', 'ready', 'out', 'delivered', 'failed', 'paid'];
  const summaryRows = stages.map((s) => {
    const stOrders = orders.filter((o) => o.status === s);
    return {
      'الحالة': STATUS_LABELS[s] || s,
      'عدد الأوردرات': stOrders.length,
      'القيمة الإجمالية': fmtNum(stOrders.reduce((sum, o) => sum + totalOf(o), 0)),
    };
  });
  summaryRows.push({
    'الحالة': 'الإجمالي الكلي',
    'عدد الأوردرات': orders.length,
    'القيمة الإجمالية': fmtNum(orders.reduce((s, o) => s + totalOf(o), 0)),
  });
  const ws6 = XLSX.utils.json_to_sheet(summaryRows);
  setColWidths(ws6, [20, 14, 18]);
  addSheet(wb, ws6, 'الملخص المالي');

  downloadWb(wb, `nabta_master_${today()}.xlsx`);
}

// ── Role router (legacy exportByRole) ───────────────────────────
// ── Finance module workbook (overview + vendor dues + commissions) ──
export function exportFinanceModuleExcel({ overview, dues, commissions }) {
  const wb = XLSX.utils.book_new();
  const s = overview?.summary || {};
  const summaryRows = [
    { 'البند': 'إجمالي المبيعات', 'القيمة': fmtNum(s.totalSales) },
    { 'البند': 'المُحصّل من العملاء', 'القيمة': fmtNum(s.totalCollected) },
    { 'البند': 'معلّق التحصيل', 'القيمة': fmtNum(s.totalPendingCollection) },
    { 'البند': 'عمولة نبتة (الربح)', 'القيمة': fmtNum(s.totalCommission) },
    { 'البند': 'مستحقات الموردين (صافي)', 'القيمة': fmtNum(s.totalVendorNetPayable) },
    { 'البند': 'المدفوع للموردين', 'القيمة': fmtNum(s.totalVendorPaid) },
    { 'البند': 'رصيد مستحق للموردين', 'القيمة': fmtNum(s.totalVendorBalance) },
  ];
  const ws1 = XLSX.utils.json_to_sheet(summaryRows);
  setColWidths(ws1, [30, 18]);
  addSheet(wb, ws1, 'الملخص');

  const dueRows = (dues || []).map((v) => ({
    'المورد': v.nameAr || v.name,
    'إجمالي البضاعة': fmtNum(v.gross),
    'العمولة': fmtNum(v.commission),
    'الصافي المستحق': fmtNum(v.netPayable),
    'المدفوع': fmtNum(v.paid),
    'الرصيد': fmtNum(v.balance),
    'شروط الدفع (يوم)': v.payoutTerms,
  }));
  const ws2 = XLSX.utils.json_to_sheet(dueRows.length ? dueRows : [{}]);
  setColWidths(ws2, [24, 16, 14, 16, 12, 12, 16]);
  addSheet(wb, ws2, 'مستحقات الموردين');

  const comRows = (commissions?.orders || []).map((o) => ({
    'رقم الأوردر': o.orderNumber,
    'التاريخ': o.date,
    'العميل': o.customer,
    'قيمة البضاعة': fmtNum(o.gross),
    'عمولة نبتة': fmtNum(o.commission),
  }));
  const ws3 = XLSX.utils.json_to_sheet(comRows.length ? comRows : [{}]);
  setColWidths(ws3, [18, 12, 20, 16, 14]);
  addSheet(wb, ws3, 'العمولات');

  downloadWb(wb, `nabta-finance-${today()}.xlsx`);
}

export function exportByRole(role, { orders, vendors = [], customers = [], drivers = [] }) {
  if (role === 'sales') exportSalesExcel(orders);
  else if (role === 'account') exportAccountExcel(orders, vendors);
  else if (role === 'ops') exportOpsExcel(orders, drivers);
  else if (role === 'finance') exportFinanceExcel(orders, vendors);
  else exportMasterExcel(orders, vendors, customers, drivers);
}

// ── Analytics export (3 sheets, legacy exportAnalyticsExcel) ────
export function exportAnalyticsExcel(orders, vendors, products) {
  const sheetOrders = orders.map((o) => {
    const sub = subtotalOf(o);
    return {
      'رقم الأوردر': o.orderNumber,
      'التاريخ': fmtDate(o.date),
      'العميل': o.customer?.name || '-',
      'المورد': vName(o),
      'السائق': o.driver?.name || '-',
      'الحالة': STATUS_LABELS[o.status] || o.status,
      'المجموع الجزئي': fmtNum(sub),
      'الضريبة': fmtNum(sub * ((o.taxRate ?? 5) / 100)),
      'رسوم التوصيل': fmtNum(o.deliveryFee || 0),
      'الإجمالي الكلي': fmtNum(totalOf(o)),
      'الملاحظات': o.notes || '',
    };
  });

  const wb = XLSX.utils.book_new();
  addSheet(wb, XLSX.utils.json_to_sheet(sheetOrders), 'الأوردرات');
  addSheet(
    wb,
    XLSX.utils.json_to_sheet(
      vendors.map((v) => ({
        'الاسم': v.nameAr || v.name,
        'الهاتف': v.phone,
        'البنك': v.bankName,
        'الآيبان': v.iban,
        'رقم الحساب': v.accountNumber,
        'صاحب الحساب': v.accountHolder,
        'شروط الدفع (أيام)': v.payoutTerms,
      }))
    ),
    'الموردون'
  );
  addSheet(
    wb,
    XLSX.utils.json_to_sheet(
      products.map((p) => ({
        'الاسم': p.nameAr || p.name,
        'الفئة': p.category,
        'السعر': p.price,
        'الوحدة': p.unit,
        'المخزون': p.stock,
      }))
    ),
    'المنتجات'
  );
  downloadWb(wb, 'nabta_analytics.xlsx');
}

// ── Products import helpers (legacy Excel import) ───────────────
export function readWorkbookRows(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws);
}

/** Legacy flexible column matching: works with Arabic or English headers. */
export function mapExcelRowToProduct(row, vendors) {
  const keys = Object.keys(row);
  const find = (test) => keys.find(test);
  const nameKey = find((k) => k.includes('اسم') || k.toLowerCase().includes('name'));
  const priceKey = find((k) => k.includes('سعر') || k.toLowerCase().includes('price'));
  const catKey = find((k) => k.includes('فئة') || k.includes('صنف') || k.toLowerCase().includes('cat'));
  const unitKey = find((k) => k.includes('وحد') || k.toLowerCase().includes('unit'));
  const stockKey = find((k) => k.includes('مخزون') || k.includes('كمية') || k.toLowerCase().includes('stock'));
  const vendorKey = find((k) => k.includes('مورد') || k.toLowerCase().includes('vendor') || k.toLowerCase().includes('supplier'));

  const name = nameKey ? String(row[nameKey]).trim() : '';
  if (!name) return null;

  const vendorName = vendorKey ? String(row[vendorKey]).trim() : '';
  const vendor = vendorName
    ? vendors.find(
        (v) =>
          v.name.toLowerCase().includes(vendorName.toLowerCase()) || (v.nameAr || '').includes(vendorName)
      )
    : null;

  return {
    nameAr: name,
    name,
    category: catKey ? String(row[catKey]) : 'عام',
    price: priceKey ? parseFloat(row[priceKey]) || 0 : 0,
    unit: unitKey ? String(row[unitKey]) : 'وحدة',
    stock: stockKey ? parseInt(row[stockKey], 10) || 0 : 0,
    vendorId: vendor?.id || null, // required by the API — rows without a match are skipped
    description: '',
  };
}

export function downloadProductsTemplate() {
  const templateData = [
    { 'اسم المنتج': 'مثال: سماد NPK', 'الفئة': 'أسمدة', 'السعر': 85, 'الوحدة': 'كيس 25 كجم', 'المخزون': 100, 'المورد': 'Yamfert' },
    { 'اسم المنتج': 'مثال: بذور طماطم', 'الفئة': 'بذور', 'السعر': 45, 'الوحدة': 'علبة', 'المخزون': 200, 'المورد': 'Rich Organics' },
  ];
  const wb = XLSX.utils.book_new();
  addSheet(wb, XLSX.utils.json_to_sheet(templateData), 'المنتجات');
  downloadWb(wb, 'nabta_products_template.xlsx');
}

// ── Vendors import helpers ──────────────────────────────────────
/** Flexible column matching (Arabic or English headers), mirrors the product mapper. */
export function mapExcelRowToVendor(row) {
  const keys = Object.keys(row);
  const find = (test) => keys.find(test);
  const str = (k) => (k && row[k] != null ? String(row[k]).trim() : '');

  // nameAr: prefer an explicit "عربي" header, else any "اسم" that isn't a bank/account/holder column.
  const nameArKey =
    find((k) => k.includes('عربي')) ||
    find((k) => k.includes('اسم') && !k.includes('بنك') && !k.includes('حساب') && !k.includes('صاحب'));
  const nameEnKey = find((k) => k.includes('إنجليزي') || k.includes('انجليزي') || /name/i.test(k));
  const phoneKey = find((k) => k.includes('هاتف') || k.includes('جوال') || /phone|mobile|tel/i.test(k));
  const emailKey = find((k) => k.includes('بريد') || /e-?mail/i.test(k));
  const addressKey = find((k) => k.includes('عنوان') || /address/i.test(k));
  const bankKey = find((k) => k.includes('بنك') || /bank/i.test(k));
  const ibanKey = find((k) => k.toLowerCase().includes('iban') || k.includes('آيبان') || k.includes('ايبان'));
  const accNumKey = find((k) => (k.includes('رقم') && k.includes('حساب')) || /account\s*(number|no)/i.test(k));
  const accHolderKey = find((k) => k.includes('صاحب') || /holder/i.test(k));
  const payoutKey = find((k) => k.includes('شروط') || k.includes('سداد') || /payout|terms/i.test(k));
  const commKey = find((k) => k.includes('عمولة') || /commission/i.test(k));
  const langKey = find((k) => k.includes('لغة') || /lang/i.test(k));
  const notesKey = find((k) => k.includes('ملاحظ') || /note/i.test(k));

  const nameAr = str(nameArKey);
  const nameEn = str(nameEnKey);
  const primary = nameAr || nameEn;
  if (!primary) return null; // a row with no name at all is unusable

  const rawLang = str(langKey).toLowerCase();
  const preferredLanguage =
    rawLang.includes('en') || rawLang.includes('إنجليز') || rawLang.includes('انجليز') ? 'en' : 'ar';

  const out = {
    nameAr: primary,
    name: nameEn || primary,
    phone: str(phoneKey),
    email: str(emailKey),
    address: str(addressKey),
    bankName: str(bankKey),
    iban: str(ibanKey),
    accountNumber: str(accNumKey),
    accountHolder: str(accHolderKey),
    payoutTerms: payoutKey ? parseInt(row[payoutKey], 10) || 0 : 0,
    preferredLanguage,
    notes: str(notesKey) || null,
  };

  // commissionRate is optional — only send it when a real number is provided.
  if (commKey && row[commKey] !== '' && row[commKey] != null) {
    const c = Number(row[commKey]);
    if (!Number.isNaN(c)) out.commissionRate = c;
  }
  return out;
}

export function downloadVendorsTemplate() {
  const templateData = [
    {
      'الاسم بالعربي': 'مثال: مزرعة الواحة',
      'الاسم بالإنجليزي': 'Oasis Farm',
      'الهاتف': '+971501234567',
      'البريد الإلكتروني': 'info@oasis.ae',
      'العنوان': 'دبي - الإمارات',
      'اسم البنك': 'بنك الإمارات دبي الوطني',
      'IBAN': 'AE070331234567890123456',
      'رقم الحساب': '1234567890',
      'اسم صاحب الحساب': 'مزرعة الواحة ش.ذ.م.م',
      'شروط الدفع (أيام)': 7,
      'نسبة العمولة %': 10,
      'لغة المراسلة': 'ar',
      'ملاحظات': '',
    },
    {
      'الاسم بالعربي': 'مثال: مشاتل الخليج',
      'الاسم بالإنجليزي': 'Gulf Nurseries',
      'الهاتف': '+971559876543',
      'البريد الإلكتروني': 'sales@gulf.ae',
      'العنوان': 'أبوظبي - الإمارات',
      'اسم البنك': 'بنك أبوظبي الأول',
      'IBAN': 'AE070339876543210987654',
      'رقم الحساب': '9876543210',
      'اسم صاحب الحساب': 'مشاتل الخليج',
      'شروط الدفع (أيام)': 0,
      'نسبة العمولة %': '',
      'لغة المراسلة': 'en',
      'ملاحظات': '',
    },
  ];
  const wb = XLSX.utils.book_new();
  addSheet(wb, XLSX.utils.json_to_sheet(templateData), 'الموردون');
  downloadWb(wb, 'nabta_vendors_template.xlsx');
}
