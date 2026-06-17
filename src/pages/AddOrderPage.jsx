import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client.js';
import { useToast } from '../components/ToastHost.jsx';
import MapPickerModal from '../components/MapPickerModal.jsx';
import { formatCurrency } from '../utils/format.js';
import { PAYMENT_METHODS } from '../constants/payments.js';

let rowKey = 0;
const newRow = () => ({ key: ++rowKey, productId: '', qty: 1 });

export default function AddOrderPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const editMode = Boolean(editId);

  const [lists, setLists] = useState(null);
  const [rows, setRows] = useState([newRow()]);
  const [location, setLocation] = useState(null); // { lat, lng, address } | null
  const [pickingLocation, setPickingLocation] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    deliveryAddress: '',
    taxRate: 5,
    deliveryFee: 0,
    paymentMethod: 'cod',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [c, v, p] = await Promise.all([
          api.get('/api/customers'),
          api.get('/api/vendors'),
          api.get('/api/products'),
        ]);
        setLists({ customers: c.data.customers, vendors: v.data.vendors, products: p.data.products });

        if (editId) {
          const { data } = await api.get(`/api/orders/${editId}`);
          const o = data.order;
          setForm({
            customerId: o.customerId,
            deliveryAddress: o.deliveryAddress || '',
            taxRate: o.taxRate ?? 5,
            deliveryFee: o.deliveryFee || 0,
            paymentMethod: o.paymentMethod || 'cod',
            notes: o.notes || '',
          });
          if (o.location?.lat) setLocation(o.location);
        }
      } catch (err) {
        showToast(apiErrorMessage(err), 'error');
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const productById = useMemo(() => {
    const m = new Map();
    (lists?.products || []).forEach((p) => m.set(p.id, p));
    return m;
  }, [lists]);

  // Live totals — price always comes from the product record, exactly like the
  // backend will charge it (createOrder reads the DB price, not a client price).
  const subtotal = rows.reduce((sum, r) => {
    const prod = productById.get(r.productId);
    return sum + (prod ? prod.price * (Number(r.qty) || 0) : 0);
  }, 0);
  const tax = (subtotal * (Number(form.taxRate) || 0)) / 100;
  const grand = subtotal + tax + (Number(form.deliveryFee) || 0);

  // Auto-split preview: group the chosen products by their vendor.
  const vendorGroups = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const prod = productById.get(r.productId);
      if (!prod) return;
      const vId = prod.vendorId || prod.vendor?.id || 'unknown';
      const vName = prod.vendor?.nameAr || prod.vendor?.name || 'غير محدد';
      const line = prod.price * (Number(r.qty) || 0);
      if (!map.has(vId)) map.set(vId, { name: vName, items: 0, subtotal: 0 });
      const g = map.get(vId);
      g.items += 1;
      g.subtotal += line;
    });
    return Array.from(map.values());
  }, [rows, productById]);

  function setRow(key, patch) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!form.customerId) return showToast('اختر العميل', 'error');
    if (!form.deliveryAddress.trim()) return showToast('أدخل عنوان التوصيل', 'error');

    const products = rows
      .filter((r) => r.productId && Number(r.qty) > 0)
      .map((r) => ({ productId: r.productId, qty: Number(r.qty) }));

    setSubmitting(true);
    try {
      if (editMode) {
        // Backend updateOrder only updates scalar fields (items are immutable after creation).
        await api.put(`/api/orders/${editId}`, {
          customerId: form.customerId,
          deliveryAddress: form.deliveryAddress.trim(),
          location,
          taxRate: Number(form.taxRate) || 5,
          deliveryFee: Number(form.deliveryFee) || 0,
          paymentMethod: form.paymentMethod,
          notes: form.notes,
        });
        showToast('تم تعديل الطلب', 'success');
      } else {
        if (!products.length) {
          showToast('أضف منتجاً على الأقل', 'error');
          setSubmitting(false);
          return;
        }
        const { data } = await api.post('/api/orders', {
          customerId: form.customerId,
          products,
          deliveryAddress: form.deliveryAddress.trim(),
          location,
          deliveryFee: Number(form.deliveryFee) || 0,
          taxRate: Number(form.taxRate) || 5,
          paymentMethod: form.paymentMethod,
          notes: form.notes,
        });
        showToast(`تم إنشاء الطلب ${data.order.orderNumber}`, 'success');
      }
      navigate('/orders');
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!lists) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="page-toolbar">
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{editMode ? 'تعديل الطلب' : 'إضافة طلب جديد'}</h3>
        <button className="btn btn-secondary" onClick={() => navigate('/orders')}>← رجوع</button>
      </div>

      <div className="card">
        <div className="card-header"><h3>بيانات العميل والدفع</h3></div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label>العميل <span className="required-star">*</span></label>
              <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                <option value="">-- اختر عميل --</option>
                {lists.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>طريقة الدفع <span className="required-star">*</span></label>
              <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                {PAYMENT_METHODS.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>معدل الضريبة (%)</label>
              <input
                type="number" min="0" max="100" value={form.taxRate}
                onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>رسوم التوصيل (د.إ)</label>
              <input
                type="number" min="0" value={form.deliveryFee}
                onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3>عنوان التوصيل والموقع</h3></div>
        <div className="card-body">
          <div className="form-group">
            <label>عنوان التوصيل <span className="required-star">*</span></label>
            <input
              type="text" placeholder="أدخل العنوان التفصيلي" value={form.deliveryAddress}
              onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>الموقع على الخريطة</label>
              <input
                type="text"
                readOnly
                placeholder="لم يتم تحديد الموقع"
                value={location ? location.address : ''}
                style={{ background: 'var(--gray-50)', cursor: 'pointer' }}
                onClick={() => setPickingLocation(true)}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-secondary btn-full" onClick={() => setPickingLocation(true)}>
                <i className="fa-solid fa-location-dot" aria-hidden="true" /> اختيار الموقع من الخريطة
              </button>
            </div>
          </div>
          {location && (
            <div className="location-display">
              <i className="fa-solid fa-location-dot" aria-hidden="true" /> {location.address}
            </div>
          )}
        </div>
      </div>

      {pickingLocation && (
        <MapPickerModal
          initial={location}
          onClose={() => setPickingLocation(false)}
          onPick={(loc) => {
            setLocation(loc);
            setPickingLocation(false);
          }}
        />
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3>المنتجات</h3>
          {!editMode && (
            <button className="btn btn-primary btn-sm" onClick={() => setRows((rs) => [...rs, newRow()])}>
              + إضافة منتج
            </button>
          )}
        </div>
        <div className="card-body">
          {editMode ? (
            <p className="text-muted" style={{ fontSize: 13 }}>
              لا يمكن تعديل المنتجات بعد إنشاء الطلب — لإجراء تغيير على الأصناف قم بإنشاء طلب جديد.
            </p>
          ) : (
            <>
              <p className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                يتم تحديد المورد تلقائياً حسب كل منتج، ويُقسَّم الطلب على الموردين عند الحاجة.
              </p>
              <div className="order-products-list">
                <div
                  className="order-product-row"
                  style={{ background: 'var(--gray-50)', fontSize: 12, fontWeight: 700, color: 'var(--gray-600)' }}
                >
                  <span>المنتج / المورد</span><span>الكمية</span><span>السعر</span><span>الإجمالي</span><span></span>
                </div>
                {rows.map((r) => {
                  const prod = productById.get(r.productId);
                  const price = prod?.price || 0;
                  return (
                    <div className="order-product-row" key={r.key}>
                      <div>
                        <select
                          style={{ width: '100%' }}
                          value={r.productId}
                          onChange={(e) => setRow(r.key, { productId: e.target.value })}
                        >
                          <option value="">-- اختر منتج --</option>
                          {lists.products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nameAr || p.name} {p.stock !== undefined ? `(متوفر: ${p.stock})` : ''}
                            </option>
                          ))}
                        </select>
                        {prod?.vendor && (
                          <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 3 }}>
                            <i className="fa-solid fa-store" aria-hidden="true" /> {prod.vendor.nameAr || prod.vendor.name}
                          </div>
                        )}
                      </div>
                      <input
                        type="number" min="1" value={r.qty}
                        onChange={(e) => setRow(r.key, { qty: e.target.value })}
                      />
                      <span style={{ fontSize: 13 }}>{formatCurrency(price)}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-700)' }}>
                        {formatCurrency(price * (Number(r.qty) || 0))}
                      </span>
                      <button
                        className="remove-product-row"
                        onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 10, width: '100%', border: '1px dashed var(--gray-300)' }}
                onClick={() => setRows((rs) => [...rs, newRow()])}
              >
                + إضافة منتج آخر
              </button>

              {vendorGroups.length > 1 && (
                <div className="card" style={{ marginTop: 14, background: 'var(--gray-50)' }}>
                  <div className="card-body" style={{ padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 6 }}>
                      <i className="fa-solid fa-code-branch" aria-hidden="true" /> تقسيم الطلب حسب المورد ({vendorGroups.length} موردين)
                    </div>
                    {vendorGroups.map((g, i) => (
                      <div key={i} className="total-row" style={{ fontSize: 13 }}>
                        <span><i className="fa-solid fa-store" aria-hidden="true" /> {g.name} <span className="text-muted">({g.items} صنف)</span></span>
                        <span>{formatCurrency(g.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="order-totals">
            <div className="total-row"><span>المجموع الجزئي</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="total-row"><span>الضريبة</span><span>{formatCurrency(tax)}</span></div>
            <div className="total-row"><span>رسوم التوصيل</span><span>{formatCurrency(Number(form.deliveryFee) || 0)}</span></div>
            <div className="total-row grand-total"><span>الإجمالي الكلي</span><span>{formatCurrency(grand)}</span></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3>ملاحظات</h3></div>
        <div className="card-body">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <textarea
              placeholder="أي ملاحظات خاصة بالطلب..." value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/orders')}>إلغاء</button>
        <button className="btn btn-primary btn-lg" onClick={save} disabled={submitting}>
          {submitting ? 'جارٍ الحفظ…' : editMode ? 'حفظ التعديلات' : 'إنشاء الطلب'}
        </button>
      </div>
    </div>
  );
}
