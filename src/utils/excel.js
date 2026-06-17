import * as XLSX from 'xlsx';
import i18n from '../i18n/index.js';

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
      [i18n.t('reports.orderNumber')]: o.orderNumber,
      [i18n.t('reports.createdDate')]: fmtDate(o.date),
      [i18n.t('common.customer')]: o.customer?.name || '-',
      [i18n.t('reports.customerPhone')]: o.customer?.phone || '-',
      [i18n.t('reports.deliveryAddress')]: o.deliveryAddress || '-',
      [i18n.t('common.vendor')]: vName(o),
      [i18n.t('reports.productCount')]: (o.items || []).length,
      [i18n.t('reports.subtotal')]: fmtNum(sub),
      [i18n.t('reports.vat5')]: fmtNum(tax),
      [i18n.t('reports.deliveryFee')]: fmtNum(del),
      [i18n.t('reports.grandTotal')]: fmtNum(sub + tax + del),
      [i18n.t('common.status')]: i18n.t('status.' + o.status),
      [i18n.t('reports.confirmedDate')]: fmtDate(o.confirmedAt),
      [i18n.t('common.notes')]: o.notes || '-',
    };
  });

  const rows2 = [];
  orders.forEach((o) => {
    (o.items || []).forEach((it) => {
      rows2.push({
        [i18n.t('reports.orderNumber')]: o.orderNumber,
        [i18n.t('reports.orderDate')]: fmtDate(o.date),
        [i18n.t('reports.productName')]: it.product?.nameAr || it.product?.name || it.productId,
        [i18n.t('common.quantity')]: it.qty,
        [i18n.t('reports.unit')]: it.product?.unit || '-',
        [i18n.t('common.unitPrice')]: fmtNum(it.price),
        [i18n.t('reports.lineTotal')]: fmtNum(it.qty * it.price),
        [i18n.t('common.vendor')]: vName(o),
        [i18n.t('reports.orderStatus')]: i18n.t('status.' + o.status),
      });
    });
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(rows1);
  setColWidths(ws1, [12, 12, 22, 14, 28, 20, 8, 14, 16, 12, 14, 14, 12, 24]);
  addSheet(wb, ws1, i18n.t('reports.sheetOrdersSummary'));
  const ws2 = XLSX.utils.json_to_sheet(rows2);
  setColWidths(ws2, [12, 12, 28, 8, 10, 12, 14, 20, 14]);
  addSheet(wb, ws2, i18n.t('reports.sheetProductDetails'));
  downloadWb(wb, `nabta_sales_${today()}.xlsx`);
}

// ── 2. ACCOUNT MANAGER ──────────────────────────────────────────
export function exportAccountExcel(orders, vendors) {
  const rows1 = orders.map((o) => ({
    [i18n.t('reports.orderNumber')]: o.orderNumber,
    [i18n.t('reports.orderDate')]: fmtDate(o.date),
    [i18n.t('common.customer')]: o.customer?.name || '-',
    [i18n.t('common.vendor')]: vName(o),
    [i18n.t('reports.vendorPhone')]: o.vendor?.phone || '-',
    [i18n.t('reports.vendorEmail')]: o.vendor?.email || '-',
    [i18n.t('reports.products')]: (o.items || [])
      .map((it) => `${it.product?.nameAr || it.productId} (${it.qty})`)
      .join(' | '),
    [i18n.t('common.total')]: fmtNum(totalOf(o)),
    [i18n.t('reports.confirmedDate')]: fmtDate(o.confirmedAt),
    [i18n.t('reports.preparationStartDate')]: fmtDate(o.preparedAt),
    [i18n.t('reports.readyDate')]: fmtDate(o.readyAt),
    [i18n.t('reports.currentStatus')]: i18n.t('status.' + o.status),
    [i18n.t('reports.vendorNotes')]: '-',
  }));

  const rows2 = vendors.map((v) => {
    const vOrders = orders.filter((o) => o.vendorId === v.id);
    return {
      [i18n.t('common.vendor')]: v.nameAr || v.name,
      [i18n.t('common.phone')]: v.phone || '-',
      [i18n.t('reports.totalOrders')]: vOrders.length,
      [i18n.t('reports.totalValue')]: fmtNum(vOrders.reduce((s, o) => s + totalOf(o), 0)),
      [i18n.t('reports.confirmedCount')]: vOrders.filter((o) => o.status === 'confirmed').length,
      [i18n.t('reports.preparingCount')]: vOrders.filter((o) => o.status === 'preparing').length,
      [i18n.t('reports.readyForDeliveryCount')]: vOrders.filter((o) => o.status === 'ready').length,
      [i18n.t('reports.deliveredCount')]: vOrders.filter((o) => ['delivered', 'paid'].includes(o.status)).length,
      [i18n.t('reports.payoutTermsDays')]: v.payoutTerms === 0 ? i18n.t('reports.immediate') : `${v.payoutTerms} ${i18n.t('reports.day')}`,
    };
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(rows1);
  setColWidths(ws1, [12, 12, 22, 20, 14, 24, 48, 12, 14, 16, 14, 16, 24]);
  addSheet(wb, ws1, i18n.t('reports.sheetVendorOrders'));
  const ws2 = XLSX.utils.json_to_sheet(rows2);
  setColWidths(ws2, [22, 14, 10, 14, 8, 12, 12, 10, 14]);
  addSheet(wb, ws2, i18n.t('reports.sheetVendorsSummary'));
  downloadWb(wb, `nabta_account_${today()}.xlsx`);
}

// ── 3. OPERATIONS ───────────────────────────────────────────────
export function exportOpsExcel(orders, drivers) {
  const rows1 = orders.map((o) => ({
    [i18n.t('reports.orderNumber')]: o.orderNumber,
    [i18n.t('reports.orderDate')]: fmtDate(o.date),
    [i18n.t('common.customer')]: o.customer?.name || '-',
    [i18n.t('reports.customerPhone')]: o.customer?.phone || '-',
    [i18n.t('reports.deliveryAddress')]: o.deliveryAddress || '-',
    [i18n.t('reports.locationLat')]: o.location?.lat ?? '-',
    [i18n.t('reports.locationLng')]: o.location?.lng ?? '-',
    [i18n.t('common.driver')]: o.driver?.name || i18n.t('reports.unassigned'),
    [i18n.t('reports.driverPhone')]: o.driver?.phone || '-',
    [i18n.t('reports.vehicle')]: o.vehicle?.plate || i18n.t('reports.unassignedF'),
    [i18n.t('reports.vehicleType')]: o.vehicle?.model || '-',
    [i18n.t('reports.route')]: o.route?.name || '-',
    [i18n.t('reports.readyDate')]: fmtDate(o.readyAt),
    [i18n.t('reports.dispatchDate')]: fmtDate(o.dispatchedAt),
    [i18n.t('reports.deliveryDate')]: fmtDate(o.deliveredAt),
    [i18n.t('reports.deliveryStatus')]: i18n.t('status.' + o.status),
    [i18n.t('reports.failureReason')]: o.failureReason || '-',
  }));

  const rows2 = drivers.map((d) => {
    const dOrders = orders.filter((o) => o.driverId === d.id);
    const delivered = dOrders.filter((o) => o.status === 'delivered' || o.status === 'paid').length;
    const failed = dOrders.filter((o) => o.status === 'failed').length;
    const total = dOrders.length;
    return {
      [i18n.t('common.driver')]: d.name,
      [i18n.t('common.phone')]: d.phone || '-',
      [i18n.t('reports.vehicle')]: d.vehicle?.plate || '-',
      [i18n.t('reports.totalOrders')]: total,
      [i18n.t('reports.deliveredCount')]: delivered,
      [i18n.t('reports.failedCount')]: failed,
      [i18n.t('reports.inProgressCount')]: dOrders.filter((o) => o.status === 'out').length,
      [i18n.t('reports.successRate')]: total > 0 ? ((delivered / total) * 100).toFixed(0) + '%' : '-',
    };
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(rows1);
  setColWidths(ws1, [12, 12, 22, 14, 28, 12, 12, 18, 14, 14, 18, 16, 14, 14, 14, 16, 20]);
  addSheet(wb, ws1, i18n.t('reports.sheetDeliveryOrders'));
  const ws2 = XLSX.utils.json_to_sheet(rows2.length ? rows2 : [{ [i18n.t('reports.noData')]: '-' }]);
  setColWidths(ws2, [22, 14, 14, 10, 10, 10, 10, 10]);
  addSheet(wb, ws2, i18n.t('reports.sheetDriverPerformance'));
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
      [i18n.t('reports.orderNumber')]: o.orderNumber,
      [i18n.t('reports.orderDate')]: fmtDate(o.date),
      [i18n.t('reports.deliveryDate')]: fmtDate(o.deliveredAt),
      [i18n.t('common.customer')]: o.customer?.name || '-',
      [i18n.t('common.vendor')]: vName(o),
      [i18n.t('reports.subtotal')]: fmtNum(sub),
      [i18n.t('reports.vat5')]: fmtNum(tax),
      [i18n.t('reports.deliveryFee')]: fmtNum(del),
      [i18n.t('reports.grandTotal')]: fmtNum(sub + tax + del),
      [i18n.t('reports.vendorPaymentStatus')]: o.status === 'paid' ? i18n.t('reports.paid') : i18n.t('reports.pending'),
      [i18n.t('reports.vendorPaymentDate')]: fmtDate(o.paidAt),
      [i18n.t('reports.transferProof')]: o.paymentProof || '-',
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
      [i18n.t('common.vendor')]: v.nameAr || v.name,
      [i18n.t('reports.bank')]: v.bankName || '-',
      [i18n.t('reports.accountHolder')]: v.accountHolder || '-',
      ['IBAN']: v.iban || '-',
      [i18n.t('reports.accountNumber')]: v.accountNumber || '-',
      [i18n.t('reports.amountPaid')]: fmtNum(paid.reduce((s, o) => s + totalOf(o), 0)),
      [i18n.t('reports.amountPending')]: fmtNum(totPend),
      [i18n.t('reports.payoutTermsDays')]: v.payoutTerms === 0 ? i18n.t('reports.immediate') : String(v.payoutTerms),
      [i18n.t('reports.nextDueDate')]: nextDue,
      [i18n.t('reports.paymentStatus')]: totPend > 0 ? i18n.t('reports.hasPending') : i18n.t('reports.allSettled'),
    };
  });

  const allSub = delivered.reduce((s, o) => s + subtotalOf(o), 0);
  const allTax = delivered.reduce((s, o) => s + subtotalOf(o) * ((o.taxRate ?? 5) / 100), 0);
  const allDel = delivered.reduce((s, o) => s + (o.deliveryFee || 0), 0);
  const itemKey = i18n.t('reports.item');
  const amountAedKey = i18n.t('reports.amountAed');
  const rows3 = [
    { [itemKey]: i18n.t('reports.totalDeliveredSales'), [amountAedKey]: fmtNum(allSub + allTax + allDel) },
    { [itemKey]: i18n.t('reports.totalSubtotals'), [amountAedKey]: fmtNum(allSub) },
    { [itemKey]: i18n.t('reports.vatCollected'), [amountAedKey]: fmtNum(allTax) },
    { [itemKey]: i18n.t('reports.totalDeliveryFees'), [amountAedKey]: fmtNum(allDel) },
    { [itemKey]: '---', [amountAedKey]: '' },
    { [itemKey]: i18n.t('reports.paidToVendors'), [amountAedKey]: fmtNum(orders.filter((o) => o.status === 'paid').reduce((s, o) => s + totalOf(o), 0)) },
    { [itemKey]: i18n.t('reports.pendingToVendors'), [amountAedKey]: fmtNum(orders.filter((o) => o.status === 'delivered').reduce((s, o) => s + totalOf(o), 0)) },
    { [itemKey]: '---', [amountAedKey]: '' },
    { [itemKey]: i18n.t('reports.deliveredOrdersCount'), [amountAedKey]: delivered.length },
    { [itemKey]: i18n.t('reports.vendorPaidOrdersCount'), [amountAedKey]: orders.filter((o) => o.status === 'paid').length },
  ];

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(rows1);
  setColWidths(ws1, [12, 12, 14, 22, 22, 14, 18, 12, 14, 16, 14, 20]);
  addSheet(wb, ws1, i18n.t('reports.sheetSalesInvoices'));
  const ws2 = XLSX.utils.json_to_sheet(rows2);
  setColWidths(ws2, [22, 22, 22, 32, 16, 14, 14, 14, 16, 18]);
  addSheet(wb, ws2, i18n.t('reports.sheetVendorPayments'));
  const ws3 = XLSX.utils.json_to_sheet(rows3);
  setColWidths(ws3, [38, 16]);
  addSheet(wb, ws3, i18n.t('reports.sheetFinancialSummary'));
  downloadWb(wb, `nabta_finance_${today()}.xlsx`);
}

// ── 5. ADMIN MASTER (6 sheets) ──────────────────────────────────
export function exportMasterExcel(orders, vendors, customers, drivers) {
  const wb = XLSX.utils.book_new();

  const allOrderRows = orders.map((o) => {
    const sub = subtotalOf(o);
    const tax = sub * ((o.taxRate ?? 5) / 100);
    return {
      [i18n.t('reports.orderNumber')]: o.orderNumber,
      [i18n.t('common.date')]: fmtDate(o.date),
      [i18n.t('common.customer')]: o.customer?.name || '-',
      [i18n.t('reports.customerPhone')]: o.customer?.phone || '-',
      [i18n.t('common.vendor')]: vName(o),
      [i18n.t('common.driver')]: o.driver?.name || '-',
      [i18n.t('reports.deliveryAddress')]: o.deliveryAddress || '-',
      [i18n.t('reports.subtotal')]: fmtNum(sub),
      [i18n.t('reports.tax')]: fmtNum(tax),
      [i18n.t('reports.deliveryFee')]: fmtNum(o.deliveryFee || 0),
      [i18n.t('common.total')]: fmtNum(sub + tax + (o.deliveryFee || 0)),
      [i18n.t('common.status')]: i18n.t('status.' + o.status),
      [i18n.t('reports.confirmedDate')]: fmtDate(o.confirmedAt),
      [i18n.t('reports.preparationDate')]: fmtDate(o.preparedAt),
      [i18n.t('reports.readyDate')]: fmtDate(o.readyAt),
      [i18n.t('reports.dispatchDate')]: fmtDate(o.dispatchedAt),
      [i18n.t('reports.deliveryDate')]: fmtDate(o.deliveredAt),
      [i18n.t('reports.paymentDate')]: fmtDate(o.paidAt),
      [i18n.t('reports.paymentProof')]: o.paymentProof || '-',
      [i18n.t('common.notes')]: o.notes || '-',
    };
  });
  const ws1 = XLSX.utils.json_to_sheet(allOrderRows);
  setColWidths(ws1, [12, 12, 22, 14, 20, 18, 28, 12, 10, 12, 12, 16, 12, 12, 12, 12, 12, 12, 16, 24]);
  addSheet(wb, ws1, i18n.t('reports.sheetAllOrders'));

  const prodRows = [];
  orders.forEach((o) => {
    (o.items || []).forEach((it) => {
      prodRows.push({
        [i18n.t('reports.orderNumber')]: o.orderNumber,
        [i18n.t('common.product')]: it.product?.nameAr || it.product?.name || it.productId,
        [i18n.t('common.quantity')]: it.qty,
        [i18n.t('common.unitPrice')]: fmtNum(it.price),
        [i18n.t('common.total')]: fmtNum(it.qty * it.price),
        [i18n.t('common.vendor')]: vName(o),
      });
    });
  });
  const ws2 = XLSX.utils.json_to_sheet(prodRows.length ? prodRows : [{ [i18n.t('reports.noData')]: '-' }]);
  setColWidths(ws2, [12, 28, 8, 12, 12, 20]);
  addSheet(wb, ws2, i18n.t('reports.sheetProductDetails'));

  const ws3 = XLSX.utils.json_to_sheet(
    vendors.map((v) => ({
      [i18n.t('common.vendor')]: v.nameAr || v.name,
      [i18n.t('common.phone')]: v.phone || '-',
      [i18n.t('common.email')]: v.email || '-',
      [i18n.t('reports.bank')]: v.bankName || '-',
      ['IBAN']: v.iban || '-',
      [i18n.t('reports.accountNumber')]: v.accountNumber || '-',
      [i18n.t('reports.accountHolder')]: v.accountHolder || '-',
      [i18n.t('reports.payoutTermsDays')]: v.payoutTerms === 0 ? i18n.t('reports.immediate') : String(v.payoutTerms),
    }))
  );
  setColWidths(ws3, [22, 14, 26, 22, 32, 16, 22, 14]);
  addSheet(wb, ws3, i18n.t('reports.sheetVendors'));

  const ws4 = XLSX.utils.json_to_sheet(
    customers.map((c) => ({
      [i18n.t('common.customer')]: c.name,
      [i18n.t('common.phone')]: c.phone || '-',
      [i18n.t('common.email')]: c.email || '-',
      [i18n.t('common.address')]: c.address || '-',
      [i18n.t('common.notes')]: c.notes || '-',
    }))
  );
  setColWidths(ws4, [22, 14, 26, 32, 24]);
  addSheet(wb, ws4, i18n.t('reports.sheetCustomers'));

  const drvRows = drivers.map((d) => ({
    [i18n.t('common.driver')]: d.name,
    [i18n.t('common.phone')]: d.phone || '-',
    [i18n.t('reports.vehicle')]: d.vehicle?.plate || '-',
    [i18n.t('reports.vehicleModel')]: d.vehicle?.model || '-',
    [i18n.t('reports.vehicleType')]: d.vehicle?.type || '-',
    [i18n.t('common.status')]: d.status === 'active' ? i18n.t('reports.active') : i18n.t('reports.inactive'),
  }));
  const ws5 = XLSX.utils.json_to_sheet(drvRows.length ? drvRows : [{ [i18n.t('reports.noData')]: '-' }]);
  setColWidths(ws5, [22, 14, 16, 20, 14, 10]);
  addSheet(wb, ws5, i18n.t('reports.sheetDrivers'));

  const stages = ['new', 'confirmed', 'preparing', 'ready', 'out', 'delivered', 'failed', 'paid'];
  const summaryRows = stages.map((s) => {
    const stOrders = orders.filter((o) => o.status === s);
    return {
      [i18n.t('common.status')]: i18n.t('status.' + s),
      [i18n.t('reports.orderCount')]: stOrders.length,
      [i18n.t('reports.totalValue')]: fmtNum(stOrders.reduce((sum, o) => sum + totalOf(o), 0)),
    };
  });
  summaryRows.push({
    [i18n.t('common.status')]: i18n.t('reports.grandTotal'),
    [i18n.t('reports.orderCount')]: orders.length,
    [i18n.t('reports.totalValue')]: fmtNum(orders.reduce((s, o) => s + totalOf(o), 0)),
  });
  const ws6 = XLSX.utils.json_to_sheet(summaryRows);
  setColWidths(ws6, [20, 14, 18]);
  addSheet(wb, ws6, i18n.t('reports.sheetFinancialSummary'));

  downloadWb(wb, `nabta_master_${today()}.xlsx`);
}

// ── Role router (legacy exportByRole) ───────────────────────────
// ── Finance module workbook (overview + vendor dues + commissions) ──
export function exportFinanceModuleExcel({ overview, dues, commissions }) {
  const wb = XLSX.utils.book_new();
  const s = overview?.summary || {};
  const fmItemKey = i18n.t('reports.item');
  const fmValueKey = i18n.t('reports.value');
  const summaryRows = [
    { [fmItemKey]: i18n.t('reports.totalSales'), [fmValueKey]: fmtNum(s.totalSales) },
    { [fmItemKey]: i18n.t('reports.collectedFromCustomers'), [fmValueKey]: fmtNum(s.totalCollected) },
    { [fmItemKey]: i18n.t('reports.pendingCollection'), [fmValueKey]: fmtNum(s.totalPendingCollection) },
    { [fmItemKey]: i18n.t('reports.nabtaCommissionProfit'), [fmValueKey]: fmtNum(s.totalCommission) },
    { [fmItemKey]: i18n.t('reports.vendorNetPayable'), [fmValueKey]: fmtNum(s.totalVendorNetPayable) },
    { [fmItemKey]: i18n.t('reports.paidToVendors'), [fmValueKey]: fmtNum(s.totalVendorPaid) },
    { [fmItemKey]: i18n.t('reports.vendorOutstandingBalance'), [fmValueKey]: fmtNum(s.totalVendorBalance) },
  ];
  const ws1 = XLSX.utils.json_to_sheet(summaryRows);
  setColWidths(ws1, [30, 18]);
  addSheet(wb, ws1, i18n.t('reports.sheetSummary'));

  const dueRows = (dues || []).map((v) => ({
    [i18n.t('common.vendor')]: v.nameAr || v.name,
    [i18n.t('reports.grossGoods')]: fmtNum(v.gross),
    [i18n.t('reports.commission')]: fmtNum(v.commission),
    [i18n.t('reports.netPayable')]: fmtNum(v.netPayable),
    [i18n.t('reports.paidLabel')]: fmtNum(v.paid),
    [i18n.t('reports.balance')]: fmtNum(v.balance),
    [i18n.t('reports.payoutTermsDays')]: v.payoutTerms,
  }));
  const ws2 = XLSX.utils.json_to_sheet(dueRows.length ? dueRows : [{}]);
  setColWidths(ws2, [24, 16, 14, 16, 12, 12, 16]);
  addSheet(wb, ws2, i18n.t('reports.sheetVendorDues'));

  const comRows = (commissions?.orders || []).map((o) => ({
    [i18n.t('reports.orderNumber')]: o.orderNumber,
    [i18n.t('common.date')]: o.date,
    [i18n.t('common.customer')]: o.customer,
    [i18n.t('reports.goodsValue')]: fmtNum(o.gross),
    [i18n.t('reports.nabtaCommission')]: fmtNum(o.commission),
  }));
  const ws3 = XLSX.utils.json_to_sheet(comRows.length ? comRows : [{}]);
  setColWidths(ws3, [18, 12, 20, 16, 14]);
  addSheet(wb, ws3, i18n.t('reports.sheetCommissions'));

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
      [i18n.t('reports.orderNumber')]: o.orderNumber,
      [i18n.t('common.date')]: fmtDate(o.date),
      [i18n.t('common.customer')]: o.customer?.name || '-',
      [i18n.t('common.vendor')]: vName(o),
      [i18n.t('common.driver')]: o.driver?.name || '-',
      [i18n.t('common.status')]: i18n.t('status.' + o.status),
      [i18n.t('reports.subtotal')]: fmtNum(sub),
      [i18n.t('reports.tax')]: fmtNum(sub * ((o.taxRate ?? 5) / 100)),
      [i18n.t('reports.deliveryFee')]: fmtNum(o.deliveryFee || 0),
      [i18n.t('reports.grandTotal')]: fmtNum(totalOf(o)),
      [i18n.t('common.notes')]: o.notes || '',
    };
  });

  const wb = XLSX.utils.book_new();
  addSheet(wb, XLSX.utils.json_to_sheet(sheetOrders), i18n.t('reports.sheetOrders'));
  addSheet(
    wb,
    XLSX.utils.json_to_sheet(
      vendors.map((v) => ({
        [i18n.t('common.name')]: v.nameAr || v.name,
        [i18n.t('common.phone')]: v.phone,
        [i18n.t('reports.bank')]: v.bankName,
        [i18n.t('reports.iban')]: v.iban,
        [i18n.t('reports.accountNumber')]: v.accountNumber,
        [i18n.t('reports.accountHolder')]: v.accountHolder,
        [i18n.t('reports.payoutTermsDaysPlural')]: v.payoutTerms,
      }))
    ),
    i18n.t('reports.sheetVendors')
  );
  addSheet(
    wb,
    XLSX.utils.json_to_sheet(
      products.map((p) => ({
        [i18n.t('common.name')]: p.nameAr || p.name,
        [i18n.t('reports.category')]: p.category,
        [i18n.t('reports.price')]: p.price,
        [i18n.t('reports.unit')]: p.unit,
        [i18n.t('reports.stock')]: p.stock,
      }))
    ),
    i18n.t('reports.sheetProducts')
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
    {
      [i18n.t('reports.productName')]: i18n.t('reports.tplProductExample1'),
      [i18n.t('reports.category')]: i18n.t('reports.tplCategoryFertilizers'),
      [i18n.t('reports.price')]: 85,
      [i18n.t('reports.unit')]: i18n.t('reports.tplUnitBag25kg'),
      [i18n.t('reports.stock')]: 100,
      [i18n.t('common.vendor')]: 'Yamfert',
    },
    {
      [i18n.t('reports.productName')]: i18n.t('reports.tplProductExample2'),
      [i18n.t('reports.category')]: i18n.t('reports.tplCategorySeeds'),
      [i18n.t('reports.price')]: 45,
      [i18n.t('reports.unit')]: i18n.t('reports.tplUnitBox'),
      [i18n.t('reports.stock')]: 200,
      [i18n.t('common.vendor')]: 'Rich Organics',
    },
  ];
  const wb = XLSX.utils.book_new();
  addSheet(wb, XLSX.utils.json_to_sheet(templateData), i18n.t('reports.sheetProducts'));
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
      [i18n.t('reports.nameAr')]: i18n.t('reports.tplVendorExample1'),
      [i18n.t('reports.nameEn')]: 'Oasis Farm',
      [i18n.t('common.phone')]: '+971501234567',
      [i18n.t('common.email')]: 'info@oasis.ae',
      [i18n.t('common.address')]: i18n.t('reports.tplAddressDubai'),
      [i18n.t('reports.bankName')]: i18n.t('reports.tplBankEnbd'),
      ['IBAN']: 'AE070331234567890123456',
      [i18n.t('reports.accountNumber')]: '1234567890',
      [i18n.t('reports.accountHolderName')]: i18n.t('reports.tplAccountHolder1'),
      [i18n.t('reports.payoutTermsDaysPlural')]: 7,
      [i18n.t('reports.commissionRatePct')]: 10,
      [i18n.t('reports.messagingLanguage')]: 'ar',
      [i18n.t('common.notes')]: '',
    },
    {
      [i18n.t('reports.nameAr')]: i18n.t('reports.tplVendorExample2'),
      [i18n.t('reports.nameEn')]: 'Gulf Nurseries',
      [i18n.t('common.phone')]: '+971559876543',
      [i18n.t('common.email')]: 'sales@gulf.ae',
      [i18n.t('common.address')]: i18n.t('reports.tplAddressAbuDhabi'),
      [i18n.t('reports.bankName')]: i18n.t('reports.tplBankFab'),
      ['IBAN']: 'AE070339876543210987654',
      [i18n.t('reports.accountNumber')]: '9876543210',
      [i18n.t('reports.accountHolderName')]: i18n.t('reports.tplAccountHolder2'),
      [i18n.t('reports.payoutTermsDaysPlural')]: 0,
      [i18n.t('reports.commissionRatePct')]: '',
      [i18n.t('reports.messagingLanguage')]: 'en',
      [i18n.t('common.notes')]: '',
    },
  ];
  const wb = XLSX.utils.book_new();
  addSheet(wb, XLSX.utils.json_to_sheet(templateData), i18n.t('reports.sheetVendors'));
  downloadWb(wb, 'nabta_vendors_template.xlsx');
}
