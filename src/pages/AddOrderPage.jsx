import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client.js';
import { useToast } from '../components/ToastHost.jsx';
import MapPickerModal from '../components/MapPickerModal.jsx';
import { formatCurrency } from '../utils/format.js';

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
    vendorId: '',
    deliveryAddress: '',
    taxRate: 5,
    deliveryFee: 0,
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
            vendorId: o.vendorId,
            deliveryAddress: o.deliveryAddress || '',
            taxRate: o.taxRate ?? 5,
            deliveryFee: o.deliveryFee || 0,
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

  function setRow(key, patch) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!form.customerId) return showToast('اختر العميل', 'error');
    if (!form.vendorId) return showToast('اختر المورد', 'error');
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
          vendorId: form.vendorId,
          deliveryAddress: form.deliveryAddress.trim(),
          location,
          taxRate: Number(form.taxRate) || 5,
          deliveryFee: Number(form.deliveryFee) || 0,
          notes: form.notes,
        });
        showToast('تم تعديل الأوردر', 'success');
      } else {
        if (!products.length) {
          showToast('أضف منتجاً على الأقل', 'error');
          setSubmitting(false);
          return;
        }
        const { data } = await api.post('/api/orders', {
          customerId: form.customerId,
          vendorId: form.vendorId,
          products,
          deliveryAddress: form.deliveryAddress.trim(),
          location,
          deliveryFee: Number(form.deliveryFee) || 0,
          taxRate: Number(form.taxRate) || 5,
          notes: form.notes,
        });
        showToast(`تم إنشاء الأوردر ${data.order.orderNumber}`, 'success');
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
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{editMode ? 'تعديل الأوردر' : 'إضافة أوردر جديد'}</h3>
        <button className="btn btn-secondary" onClick={() => navigate('/orders')}>← رجوع</button>
      </div>

      <div className="card">
        <div className="card-header"><h3>بيانات العميل والمورد</h3></div>
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
              <label>المورد <span className="required-star">*</span></label>
              <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
                <option value="">-- اختر مورد --</option>
                {lists.vendors.map((v) => <option key={v.id} value={v.id}>{v.nameAr || v.name}</option>)}
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
              لا يمكن تعديل المنتجات بعد إنشاء الأوردر — لإجراء تغيير على الأصناف قم بإنشاء أوردر جديد.
            </p>
          ) : (
            <>
              <div className="order-products-list">
                <div
                  className="order-product-row"
                  style={{ background: 'var(--gray-50)', fontSize: 12, fontWeight: 700, color: 'var(--gray-600)' }}
                >
                  <span>المنتج</span><span>الكمية</span><span>السعر</span><span>الإجمالي</span><span></span>
                </div>
                {rows.map((r) => {
                  const prod = productById.get(r.productId);
                  const price = prod?.price || 0;
                  return (
                    <div className="order-product-row" key={r.key}>
                      <select value={r.productId} onChange={(e) => setRow(r.key, { productId: e.target.value })}>
                        <option value="">-- اختر منتج --</option>
                        {lists.products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nameAr || p.name} {p.stock !== undefined ? `(متوفر: ${p.stock})` : ''}
                          </option>
                        ))}
                      </select>
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
              placeholder="أي ملاحظات خاصة بالأوردر..." value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/orders')}>إلغاء</button>
        <button className="btn btn-primary btn-lg" onClick={save} disabled={submitting}>
          {submitting ? 'جارٍ الحفظ…' : editMode ? 'حفظ التعديلات' : 'إنشاء الأوردر'}
        </button>
      </div>
    </div>
  );
}
