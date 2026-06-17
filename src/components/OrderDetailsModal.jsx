import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { apiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './ToastHost.jsx';
import { formatCurrency, orderTotals } from '../utils/format.js';
import Modal from './Modal.jsx';
import RoleGate from './RoleGate.jsx';

// Distinct vendors on an order (multi-vendor); falls back to the legacy single vendor.
function orderVendors(o) {
  if (o.vendors && o.vendors.length) return o.vendors;
  return o.vendor ? [o.vendor] : [];
}

// Vendor for a given item (snapshot → product's vendor fallback).
function itemVendorName(it) {
  const v = it.vendor || it.product?.vendor;
  return v ? v.nameAr || v.name : '-';
}

// i18n key suffixes for the customer-payment vocabulary maps.
const PAYMENT_METHOD_KEYS = { cod: 'cod', online: 'online' };
const PAYMENT_STATUS_KEYS = { unpaid: 'unpaid', pending: 'pending', paid: 'paid', failed: 'failed', cancelled: 'cancelled' };
const NOTIF_TYPE_KEYS = { invoice: 'invoice', order_confirmation: 'orderConfirmation', vendor_notice: 'vendorNotice', payment_link: 'paymentLink' };
const NOTIF_STATUS_KEYS = { sent: 'sent', failed: 'failed', link_generated: 'linkGenerated' };

const TRAIL_STEPS = ['new', 'confirmed', 'preparing', 'ready', 'out', 'delivered', 'paid'];
const CHECK_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

function AssignDriverModal({ order, onClose, onSaved }) {
  const { t } = useTranslation();
  const showToast = useToast();
  const [lists, setLists] = useState(null);
  const [form, setForm] = useState({
    driverId: order.driverId || '',
    vehicleId: order.vehicleId || '',
    routeId: order.routeId || '',
  });

  useEffect(() => {
    Promise.all([api.get('/api/drivers'), api.get('/api/vehicles'), api.get('/api/routes')])
      .then(([d, v, r]) => setLists({ drivers: d.data.drivers, vehicles: v.data.vehicles, routes: r.data.routes }))
      .catch((err) => showToast(apiErrorMessage(err), 'error'));
  }, [showToast]);

  async function save() {
    try {
      await api.put(`/api/orders/${order.id}`, {
        driverId: form.driverId || null,
        vehicleId: form.vehicleId || null,
        routeId: form.routeId || null,
      });
      showToast(t('orderDetails.driverAssigned'), 'success');
      onSaved();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  return (
    <Modal
      title={t('orderDetails.assignDriverTitle', { number: order.orderNumber })}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={!lists}>{t('common.save')}</button>
        </>
      }
    >
      {!lists ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <>
          <div className="form-group">
            <label>{t('common.driver')}</label>
            <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
              <option value="">{t('orderDetails.selectDriver')}</option>
              {lists.drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>{t('orderDetails.vehicle')}</label>
            <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">{t('orderDetails.selectVehicle')}</option>
              {lists.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>{t('orderDetails.route')}</label>
            <select value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })}>
              <option value="">{t('orderDetails.selectRoute')}</option>
              {lists.routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </>
      )}
    </Modal>
  );
}

function AssignAccountModal({ order, onClose, onSaved }) {
  const { t } = useTranslation();
  const showToast = useToast();
  const [managers, setManagers] = useState(null);
  const [accountId, setAccountId] = useState(order.accountId || '');

  useEffect(() => {
    api.get('/api/account-managers')
      .then((r) => setManagers(r.data.accountManagers))
      .catch((err) => showToast(apiErrorMessage(err), 'error'));
  }, [showToast]);

  async function save() {
    try {
      await api.patch(`/api/orders/${order.id}/assignment`, { accountId: accountId || null });
      showToast(accountId ? t('orderDetails.orderTransferred') : t('orderDetails.transferCancelled'), 'success');
      onSaved();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  return (
    <Modal
      title={t('orderDetails.assignAccountTitle', { number: order.orderNumber })}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={!managers}>{t('orderDetails.saveTransfer')}</button>
        </>
      }
    >
      {!managers ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <div className="form-group">
          <label>{t('orderDetails.accountManager')}</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">{t('orderDetails.noneCancelTransfer')}</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
            {t('orderDetails.transferHint')}
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * Order details modal — the React port of legacy viewOrder().
 * `order` must come from the API with its includes (customer, vendor, driver,
 * vehicle, route, items.product). `onChanged` is called after any mutation so
 * the parent can refetch.
 */
export default function OrderDetailsModal({ order, onClose, onChanged }) {
  const { t } = useTranslation();
  const { role } = useAuth();
  const showToast = useToast();
  const [assigning, setAssigning] = useState(false);
  const [assigningAccount, setAssigningAccount] = useState(false);
  const [busy, setBusy] = useState(false);

  const o = order;
  const curIdx = TRAIL_STEPS.indexOf(o.status);
  const { subtotal, taxRate, tax, deliveryFee, total } = orderTotals(o);
  const vendors = orderVendors(o);
  const [notifications, setNotifications] = useState([]);

  const paymentMethodLabel = (m) => (PAYMENT_METHOD_KEYS[m] ? t(`orderDetails.paymentMethod.${PAYMENT_METHOD_KEYS[m]}`) : m || '-');
  const paymentStatusLabel = (s) => (PAYMENT_STATUS_KEYS[s] ? t(`orderDetails.paymentStatus.${PAYMENT_STATUS_KEYS[s]}`) : s || '-');
  const notifTypeLabel = (ty) => (NOTIF_TYPE_KEYS[ty] ? t(`orderDetails.notifType.${NOTIF_TYPE_KEYS[ty]}`) : ty);
  const notifStatusLabel = (st) => (NOTIF_STATUS_KEYS[st] ? t(`orderDetails.notifStatus.${NOTIF_STATUS_KEYS[st]}`) : st);

  async function reloadNotifs() {
    try {
      const { data } = await api.get(`/api/orders/${o.id}/notifications`);
      setNotifications(data.notifications || []);
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    reloadNotifs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.id]);

  async function patchStatus(payload, successMsg) {
    setBusy(true);
    try {
      await api.patch(`/api/orders/${o.id}/status`, payload);
      showToast(successMsg, payload.status === 'failed' ? 'error' : 'success');
      onChanged();
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  function markPaid() {
    const proof = window.prompt(t('orderDetails.transferProofPrompt'));
    if (proof === null) return;
    patchStatus({ status: 'paid', paymentProof: proof || t('orderDetails.proofDone') }, t('orderDetails.vendorPaymentRecorded'));
  }

  // Open the printable hosted invoice (ensures it exists first).
  async function viewInvoice() {
    setBusy(true);
    try {
      const { data } = await api.get(`/api/orders/${o.id}/invoice`);
      window.open(data.publicUrl, '_blank');
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  // Send invoice by email + open the customer's WhatsApp with a prefilled link.
  async function sendInvoice() {
    setBusy(true);
    try {
      const { data } = await api.post(`/api/orders/${o.id}/invoice/send`);
      if (data.email?.attempted) {
        showToast(data.email.ok ? t('orderDetails.invoiceEmailed') : t('orderDetails.emailFailed'), data.email.ok ? 'success' : 'error');
      } else {
        showToast(t('orderDetails.noCustomerEmail'), 'error');
      }
      if (data.waLink) window.open(data.waLink, '_blank');
      reloadNotifs();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  // (Re)send the per-vendor confirmation notices (each vendor gets only its items).
  async function notifyVendors() {
    setBusy(true);
    try {
      const { data } = await api.post(`/api/orders/${o.id}/notify-vendors`);
      const n = data.results?.length || 0;
      showToast(n ? t('orderDetails.vendorNoticesReady', { count: n }) : t('orderDetails.noVendorsToNotify'), n ? 'success' : 'error');
      reloadNotifs();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  // Online payment: create a Stripe (or stub) link and send it to the customer.
  async function sendPaymentLink() {
    setBusy(true);
    try {
      const { data } = await api.post(`/api/orders/${o.id}/payment`);
      showToast(data.stub ? t('orderDetails.paymentLinkStub') : t('orderDetails.paymentLinkSent'), 'success');
      if (data.waLink) window.open(data.waLink, '_blank');
      reloadNotifs();
      onChanged();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  // Dev/test only: emulate a successful Stripe payment without real credentials.
  async function simulatePay() {
    setBusy(true);
    try {
      await api.post(`/api/orders/${o.id}/payment/simulate`, { status: 'paid' });
      showToast(t('orderDetails.markedPaidSimulated'), 'success');
      onChanged();
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  const footer = (
    <>
      <button className="btn btn-secondary" onClick={onClose}>{t('common.close')}</button>
      <RoleGate status={o.status}>
        {(action) =>
          // 'paid' has its own button below with payment proof
          action.next !== 'paid' && (
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => patchStatus({ status: action.next }, t('orderDetails.statusChanged', { number: o.orderNumber, status: t(`status.${action.next}`) }))}
            >
              {t(`orders.action.${action.next}`)}
            </button>
          )
        }
      </RoleGate>
      {o.status === 'out' && ['ops', 'admin'].includes(role) && (
        <button
          className="btn btn-danger"
          disabled={busy}
          onClick={() => patchStatus({ status: 'failed', failureReason: t('orderDetails.deliveryFailedReason') }, t('orderDetails.deliveryFailureRecorded', { number: o.orderNumber }))}
        >
          {t('orderDetails.deliveryFailed')}
        </button>
      )}
      {o.status === 'delivered' && ['finance', 'admin'].includes(role) && (
        <button className="btn btn-primary" disabled={busy} onClick={markPaid}>
          {t('orderDetails.recordVendorPayment')}
        </button>
      )}
      {o.status === 'ready' && ['ops', 'admin'].includes(role) && (
        <button className="btn btn-warning" onClick={() => setAssigning(true)}>
          {t('orderDetails.assignDriver')}
        </button>
      )}
      <RoleGate roles={['sales', 'admin']}>
        <button className="btn btn-secondary" onClick={() => setAssigningAccount(true)}>
          <i className="fa-solid fa-user-tie" aria-hidden="true" /> {t('orderDetails.transferToAccountManager')}
        </button>
      </RoleGate>
    </>
  );

  return (
    <>
      <Modal title={t('orderDetails.title', { number: o.orderNumber })} size="xl" onClose={onClose} footer={footer}>
        <div className="order-status-trail">
          {TRAIL_STEPS.map((s, i) => {
            let cls = '';
            if (i < curIdx || (o.status === 'paid' && i === TRAIL_STEPS.length - 1)) cls = 'done';
            else if (i === curIdx) cls = 'current';
            return (
              <div key={s} className={`trail-step ${cls}`}>
                <div className="trail-dot">{CHECK_SVG}</div>
                <span className="trail-label">{t(`status.${s}`)}</span>
              </div>
            );
          })}
        </div>

        <div className="order-info-grid">
          <div className="order-info-item"><div className="order-info-label">{t('orderDetails.orderNumber')}</div><div className="order-info-value fw-bold">{o.orderNumber}</div></div>
          <div className="order-info-item"><div className="order-info-label">{t('common.date')}</div><div className="order-info-value">{o.date}</div></div>
          <div className="order-info-item"><div className="order-info-label">{t('common.customer')}</div><div className="order-info-value">{o.customer?.name || '-'}</div></div>
          <div className="order-info-item"><div className="order-info-label">{t('orderDetails.customerPhone')}</div><div className="order-info-value">{o.customer?.phone || '-'}</div></div>
          <div className="order-info-item"><div className="order-info-label">{t('orderDetails.vendors')}</div><div className="order-info-value">{vendors.length ? vendors.map((v) => v.nameAr || v.name).join(t('orderDetails.listSeparator')) : '-'}</div></div>
          <div className="order-info-item"><div className="order-info-label">{t('orderDetails.paymentMethodLabel')}</div><div className="order-info-value">{paymentMethodLabel(o.paymentMethod)}</div></div>
          <div className="order-info-item"><div className="order-info-label">{t('orderDetails.paymentStatusLabel')}</div><div className="order-info-value">{paymentStatusLabel(o.paymentStatus)}</div></div>
          <div className="order-info-item"><div className="order-info-label">{t('orderDetails.deliveryAddress')}</div><div className="order-info-value">{o.deliveryAddress || '-'}</div></div>
          <div className="order-info-item"><div className="order-info-label">{t('common.driver')}</div><div className="order-info-value">{o.driver?.name || t('orderDetails.driverUnassigned')}</div></div>
          <div className="order-info-item"><div className="order-info-label">{t('orderDetails.vehicle')}</div><div className="order-info-value">{o.vehicle?.plate || t('orderDetails.vehicleUnassigned')}</div></div>
          <div className="order-info-item"><div className="order-info-label">{t('orderDetails.route')}</div><div className="order-info-value">{o.route?.name || t('orderDetails.routeUnassigned')}</div></div>
          <div className="order-info-item"><div className="order-info-label">{t('orderDetails.accountManagerInfo')}</div><div className="order-info-value">{o.account?.name || t('orderDetails.notTransferred')}</div></div>
          <div className="order-info-item"><div className="order-info-label">{t('common.location')}</div><div className="order-info-value">{o.location?.address || '-'}</div></div>
          {o.notes && (
            <div className="order-info-item" style={{ gridColumn: '1/-1' }}>
              <div className="order-info-label">{t('common.notes')}</div>
              <div className="order-info-value">{o.notes}</div>
            </div>
          )}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><h3>{t('orderDetails.products')}</h3></div>
          <div className="table-wrapper">
            <table className="products-table-mini">
              <thead>
                <tr><th>{t('common.product')}</th><th>{t('common.vendor')}</th><th>{t('common.quantity')}</th><th>{t('common.price')}</th><th>{t('common.total')}</th></tr>
              </thead>
              <tbody>
                {(o.items || []).map((it) => (
                  <tr key={it.id}>
                    <td>{it.product?.nameAr || it.product?.name || it.productId}</td>
                    <td>{itemVendorName(it)}</td>
                    <td>{it.qty}</td>
                    <td>{formatCurrency(it.price)}</td>
                    <td>{formatCurrency(it.qty * it.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: 16 }}>
            <div className="order-totals">
              <div className="total-row"><span>{t('orderDetails.subtotal')}</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="total-row"><span>{t('orderDetails.vat', { rate: taxRate })}</span><span>{formatCurrency(tax)}</span></div>
              <div className="total-row"><span>{t('orderDetails.deliveryFee')}</span><span>{formatCurrency(deliveryFee)}</span></div>
              <div className="total-row grand-total"><span>{t('orderDetails.grandTotal')}</span><span>{formatCurrency(total)}</span></div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><h3>{t('orderDetails.communicationsAndInvoice')}</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="text-muted" style={{ fontSize: 13 }}>
                {o.invoice ? t('orderDetails.invoiceNumber', { number: o.invoice.invoiceNumber }) : t('orderDetails.invoiceNotCreated')}
              </span>
              <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <RoleGate roles={['sales', 'account', 'finance', 'admin']}>
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={viewInvoice}>
                    <i className="fa-solid fa-file-invoice" aria-hidden="true" /> {t('orderDetails.viewInvoice')}
                  </button>
                </RoleGate>
                <RoleGate roles={['sales', 'account', 'finance', 'admin']}>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={sendInvoice}>
                    <i className="fa-brands fa-whatsapp" aria-hidden="true" /> {t('orderDetails.sendInvoiceToCustomer')}
                  </button>
                </RoleGate>
                <RoleGate roles={['sales', 'account', 'admin']}>
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={notifyVendors}>
                    <i className="fa-solid fa-store" aria-hidden="true" /> {t('orderDetails.notifyVendors')}
                  </button>
                </RoleGate>
              </div>
            </div>

            {notifications.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-600)' }}>{t('orderDetails.notificationsLog')}</div>
                {notifications.map((n) => (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
                    <i
                      className={n.channel === 'whatsapp' ? 'fa-brands fa-whatsapp' : 'fa-solid fa-envelope'}
                      style={{ color: n.channel === 'whatsapp' ? '#25D366' : 'var(--gray-500)' }}
                      aria-hidden="true"
                    />
                    <span>{notifTypeLabel(n.type)}</span>
                    {n.vendor && <span className="text-muted">— {n.vendor.nameAr || n.vendor.name}</span>}
                    <span className="text-muted">— {n.to}</span>
                    <span style={{ marginInlineStart: 'auto' }}>{notifStatusLabel(n.status)}</span>
                    {n.channel === 'whatsapp' && n.link && (
                      <button className="btn btn-secondary btn-sm" onClick={() => window.open(n.link, '_blank')}>
                        <i className="fa-brands fa-whatsapp" aria-hidden="true" /> {t('orderDetails.open')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {o.paymentMethod === 'online' && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header"><h3>{t('orderDetails.onlinePayment')}</h3></div>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13 }}>
                {t('orderDetails.paymentStatusLabel')}: <strong>{paymentStatusLabel(o.paymentStatus)}</strong>
              </span>
              <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <RoleGate roles={['sales', 'account', 'finance', 'admin']}>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={sendPaymentLink}>
                    <i className="fa-solid fa-link" aria-hidden="true" /> {t('orderDetails.sendPaymentLink')}
                  </button>
                </RoleGate>
                {role === 'admin' && o.paymentStatus !== 'paid' && (
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={simulatePay} title={t('orderDetails.testWithoutStripe')}>
                    <i className="fa-solid fa-flask" aria-hidden="true" /> {t('orderDetails.confirmPaymentTest')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {vendors.length > 0 && ['finance', 'admin'].includes(role) && (
          <div className="payment-details">
            <h4><i className="fa-solid fa-credit-card" aria-hidden="true" /> {t('orderDetails.vendorPaymentDetails')}</h4>
            {vendors.map((v) => (
              <div key={v.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--gray-200)' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  <i className="fa-solid fa-store" aria-hidden="true" /> {v.nameAr || v.name}
                </div>
                <div className="form-row">
                  <div><div className="order-info-label">{t('orderDetails.bank')}</div><div className="order-info-value">{v.bankName || '-'}</div></div>
                  <div><div className="order-info-label">IBAN</div><div className="order-info-value" dir="ltr" style={{ fontFamily: 'monospace' }}>{v.iban || '-'}</div></div>
                  <div><div className="order-info-label">{t('orderDetails.accountNumber')}</div><div className="order-info-value">{v.accountNumber || '-'}</div></div>
                  <div><div className="order-info-label">{t('orderDetails.accountHolder')}</div><div className="order-info-value">{v.accountHolder || '-'}</div></div>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--orange)' }}>
                  ⏰ {t('orderDetails.payoutTermsLabel')}: {v.payoutTerms === 0 ? t('orderDetails.payoutImmediate') : t('orderDetails.payoutAfterDays', { days: v.payoutTerms })}
                </div>
              </div>
            ))}
            {o.status === 'paid' && o.paymentProof && (
              <div style={{ marginTop: 8, color: 'var(--green-600)', fontWeight: 600 }}>
                <i className="fa-solid fa-check" aria-hidden="true" /> {t('orderDetails.paymentProof')}: {o.paymentProof}
              </div>
            )}
          </div>
        )}
      </Modal>

      {assigning && (
        <AssignDriverModal
          order={o}
          onClose={() => setAssigning(false)}
          onSaved={() => {
            setAssigning(false);
            onChanged();
            onClose();
          }}
        />
      )}

      {assigningAccount && (
        <AssignAccountModal
          order={o}
          onClose={() => setAssigningAccount(false)}
          onSaved={() => {
            setAssigningAccount(false);
            onChanged();
            onClose();
          }}
        />
      )}
    </>
  );
}
