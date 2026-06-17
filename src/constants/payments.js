// Customer-payment vocabulary (distinct from the vendor-payout "paid" status
// in the fulfilment flow). Used by the add-order form, order details, and the
// finance module.

export const PAYMENT_METHODS = [
  { value: 'cod', label: 'الدفع عند الاستلام (COD)' },
  { value: 'online', label: 'الدفع الإلكتروني (Online)' },
];

export const PAYMENT_METHOD_LABELS = {
  cod: 'الدفع عند الاستلام',
  online: 'الدفع الإلكتروني',
};

export const PAYMENT_STATUS_LABELS = {
  unpaid: 'غير مدفوع',
  pending: 'بانتظار الدفع',
  paid: 'مدفوع',
  failed: 'فشل الدفع',
  cancelled: 'ملغي',
};
