// Money/totals helpers — same math as legacy calcOrderTotal/calcSubtotal,
// adapted to the backend order shape (order.items[{qty, price}], not order.products).
import i18n from '../i18n/index.js';

export function formatCurrency(v) {
  const en = i18n.language === 'en';
  const amount = Number(v || 0).toLocaleString(en ? 'en-AE' : 'ar-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount} ${en ? 'AED' : 'د.إ'}`;
}

export function orderTotals(order) {
  const subtotal = (order.items || []).reduce((sum, it) => sum + it.qty * it.price, 0);
  const taxRate = order.taxRate ?? 5;
  const tax = (subtotal * taxRate) / 100;
  const total = subtotal + tax + (order.deliveryFee || 0);
  return { subtotal, taxRate, tax, deliveryFee: order.deliveryFee || 0, total };
}
