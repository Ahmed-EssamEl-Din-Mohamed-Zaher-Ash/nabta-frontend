// Customer-payment vocabulary (distinct from the vendor-payout "paid" status
// in the fulfilment flow). Used by the add-order form, order details, and the
// finance module. Display labels live in i18n under payments.method.* and
// payments.status.* — components resolve them with t(`payments.method.${value}`).

export const PAYMENT_METHODS = [{ value: 'cod' }, { value: 'online' }];
