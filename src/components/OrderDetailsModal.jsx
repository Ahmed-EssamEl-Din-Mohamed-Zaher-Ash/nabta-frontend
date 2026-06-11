import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './ToastHost.jsx';
import { STATUS_LABELS } from '../constants/permissions.js';
import { formatCurrency, orderTotals } from '../utils/format.js';
import Modal from './Modal.jsx';
import RoleGate from './RoleGate.jsx';

const TRAIL_STEPS = ['new', 'confirmed', 'preparing', 'ready', 'out', 'delivered', 'paid'];
const CHECK_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

function AssignDriverModal({ order, onClose, onSaved }) {
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
      showToast('تم تعيين السائق', 'success');
      onSaved();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  return (
    <Modal
      title={`تعيين سائق للأوردر ${order.orderNumber}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>إلغاء</button>
          <button className="btn btn-primary" onClick={save} disabled={!lists}>حفظ</button>
        </>
      }
    >
      {!lists ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <>
          <div className="form-group">
            <label>السائق</label>
            <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
              <option value="">-- اختر سائق --</option>
              {lists.drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>المركبة</label>
            <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">-- اختر مركبة --</option>
              {lists.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>المسار</label>
            <select value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })}>
              <option value="">-- اختر مسار --</option>
              {lists.routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </>
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
  const { role } = useAuth();
  const showToast = useToast();
  const [assigning, setAssigning] = useState(false);
  const [busy, setBusy] = useState(false);

  const o = order;
  const curIdx = TRAIL_STEPS.indexOf(o.status);
  const { subtotal, taxRate, tax, deliveryFee, total } = orderTotals(o);

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
    const proof = window.prompt('أدخل رقم إثبات التحويل:');
    if (proof === null) return;
    patchStatus({ status: 'paid', paymentProof: proof || 'تم' }, 'تم تسجيل الدفع للمورد');
  }

  const footer = (
    <>
      <button className="btn btn-secondary" onClick={onClose}>إغلاق</button>
      <RoleGate status={o.status}>
        {(action) =>
          // 'paid' has its own button below with payment proof
          action.next !== 'paid' && (
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => patchStatus({ status: action.next }, `تم تغيير حالة ${o.orderNumber} إلى: ${STATUS_LABELS[action.next]}`)}
            >
              {action.label}
            </button>
          )
        }
      </RoleGate>
      {o.status === 'out' && ['ops', 'admin'].includes(role) && (
        <button
          className="btn btn-danger"
          disabled={busy}
          onClick={() => patchStatus({ status: 'failed', failureReason: 'فشل التسليم' }, `تم تسجيل فشل تسليم ${o.orderNumber}`)}
        >
          فشل التسليم
        </button>
      )}
      {o.status === 'delivered' && ['finance', 'admin'].includes(role) && (
        <button className="btn btn-primary" disabled={busy} onClick={markPaid}>
          تسجيل الدفع للمورد
        </button>
      )}
      {o.status === 'ready' && ['ops', 'admin'].includes(role) && (
        <button className="btn btn-warning" onClick={() => setAssigning(true)}>
          تعيين سائق
        </button>
      )}
    </>
  );

  return (
    <>
      <Modal title={`تفاصيل الأوردر — ${o.orderNumber}`} size="xl" onClose={onClose} footer={footer}>
        <div className="order-status-trail">
          {TRAIL_STEPS.map((s, i) => {
            let cls = '';
            if (i < curIdx || (o.status === 'paid' && i === TRAIL_STEPS.length - 1)) cls = 'done';
            else if (i === curIdx) cls = 'current';
            return (
              <div key={s} className={`trail-step ${cls}`}>
                <div className="trail-dot">{CHECK_SVG}</div>
                <span className="trail-label">{STATUS_LABELS[s]}</span>
              </div>
            );
          })}
        </div>

        <div className="order-info-grid">
          <div className="order-info-item"><div className="order-info-label">رقم الأوردر</div><div className="order-info-value fw-bold">{o.orderNumber}</div></div>
          <div className="order-info-item"><div className="order-info-label">التاريخ</div><div className="order-info-value">{o.date}</div></div>
          <div className="order-info-item"><div className="order-info-label">العميل</div><div className="order-info-value">{o.customer?.name || '-'}</div></div>
          <div className="order-info-item"><div className="order-info-label">هاتف العميل</div><div className="order-info-value">{o.customer?.phone || '-'}</div></div>
          <div className="order-info-item"><div className="order-info-label">المورد</div><div className="order-info-value">{o.vendor?.nameAr || o.vendor?.name || '-'}</div></div>
          <div className="order-info-item"><div className="order-info-label">عنوان التوصيل</div><div className="order-info-value">{o.deliveryAddress || '-'}</div></div>
          <div className="order-info-item"><div className="order-info-label">السائق</div><div className="order-info-value">{o.driver?.name || 'غير محدد'}</div></div>
          <div className="order-info-item"><div className="order-info-label">المركبة</div><div className="order-info-value">{o.vehicle?.plate || 'غير محددة'}</div></div>
          <div className="order-info-item"><div className="order-info-label">المسار</div><div className="order-info-value">{o.route?.name || 'غير محدد'}</div></div>
          <div className="order-info-item"><div className="order-info-label">الموقع</div><div className="order-info-value">{o.location?.address || '-'}</div></div>
          {o.notes && (
            <div className="order-info-item" style={{ gridColumn: '1/-1' }}>
              <div className="order-info-label">ملاحظات</div>
              <div className="order-info-value">{o.notes}</div>
            </div>
          )}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><h3>المنتجات</h3></div>
          <div className="table-wrapper">
            <table className="products-table-mini">
              <thead>
                <tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
              </thead>
              <tbody>
                {(o.items || []).map((it) => (
                  <tr key={it.id}>
                    <td>{it.product?.nameAr || it.product?.name || it.productId}</td>
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
              <div className="total-row"><span>المجموع الجزئي</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="total-row"><span>ضريبة القيمة المضافة ({taxRate}%)</span><span>{formatCurrency(tax)}</span></div>
              <div className="total-row"><span>رسوم التوصيل</span><span>{formatCurrency(deliveryFee)}</span></div>
              <div className="total-row grand-total"><span>الإجمالي الكلي</span><span>{formatCurrency(total)}</span></div>
            </div>
          </div>
        </div>

        {o.vendor && ['finance', 'admin'].includes(role) && (
          <div className="payment-details">
            <h4><i className="fa-solid fa-credit-card" aria-hidden="true" /> بيانات الدفع للمورد</h4>
            <div className="form-row">
              <div><div className="order-info-label">البنك</div><div className="order-info-value">{o.vendor.bankName || '-'}</div></div>
              <div><div className="order-info-label">IBAN</div><div className="order-info-value" dir="ltr" style={{ fontFamily: 'monospace' }}>{o.vendor.iban || '-'}</div></div>
              <div><div className="order-info-label">رقم الحساب</div><div className="order-info-value">{o.vendor.accountNumber || '-'}</div></div>
              <div><div className="order-info-label">صاحب الحساب</div><div className="order-info-value">{o.vendor.accountHolder || '-'}</div></div>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--orange)' }}>
              ⏰ شروط الدفع: {o.vendor.payoutTerms === 0 ? 'دفع فوري' : `بعد ${o.vendor.payoutTerms} يوم`}
            </div>
            {o.status === 'paid' && o.paymentProof && (
              <div style={{ marginTop: 8, color: 'var(--green-600)', fontWeight: 600 }}>
                <i className="fa-solid fa-check" aria-hidden="true" /> إثبات الدفع: {o.paymentProof}
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
    </>
  );
}
