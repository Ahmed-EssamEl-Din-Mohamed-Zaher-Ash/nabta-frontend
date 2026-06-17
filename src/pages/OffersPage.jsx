import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../api/client.js';
import { useToast } from '../components/ToastHost.jsx';
import Modal from '../components/Modal.jsx';

const emptyForm = { _id: null, name: '', nameAr: '', type: 'percentage', value: '', startDate: '', endDate: '', active: true, productIds: [] };

export default function OffersPage() {
  const showToast = useToast();
  const [offers, setOffers] = useState(null);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function load() {
    try {
      const [o, p] = await Promise.all([api.get('/api/offers'), api.get('/api/products')]);
      setOffers(o.data.offers);
      setProducts(p.data.products);
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  function openEdit(o) {
    setEditing({
      _id: o.id, name: o.name, nameAr: o.nameAr, type: o.type, value: o.value,
      startDate: o.startDate?.slice(0, 10) || '', endDate: o.endDate?.slice(0, 10) || '',
      active: o.active, productIds: o.productIds || [],
    });
  }

  async function save() {
    const f = editing;
    if (!f.nameAr.trim()) return showToast('أدخل اسم العرض', 'error');
    if (!f.startDate || !f.endDate) return showToast('حدد تاريخ البداية والنهاية', 'error');
    if (f.value === '' || Number.isNaN(Number(f.value))) return showToast('أدخل قيمة العرض', 'error');
    const payload = {
      name: f.name.trim() || f.nameAr.trim(), nameAr: f.nameAr.trim(), type: f.type,
      value: Number(f.value), startDate: f.startDate, endDate: f.endDate, active: f.active, productIds: f.productIds,
    };
    try {
      if (f._id) await api.put(`/api/offers/${f._id}`, payload);
      else await api.post('/api/offers', payload);
      showToast('تم حفظ العرض', 'success');
      setEditing(null);
      load();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  async function toggle(o) {
    try { await api.put(`/api/offers/${o.id}`, { active: !o.active }); load(); }
    catch (err) { showToast(apiErrorMessage(err), 'error'); }
  }

  async function remove(o) {
    if (!window.confirm('حذف هذا العرض؟')) return;
    try { await api.delete(`/api/offers/${o.id}`); showToast('تم حذف العرض', 'success'); load(); }
    catch (err) { showToast(apiErrorMessage(err), 'error'); }
  }

  if (!offers) return <div className="loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-toolbar">
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>العروض والخصومات</h3>
        <button className="btn btn-primary" onClick={() => setEditing({ ...emptyForm })}>+ إضافة عرض</button>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>العرض</th><th>النوع</th><th>القيمة</th><th>الفترة</th><th>المنتجات</th><th>الحالة</th><th>إجراءات</th></tr>
            </thead>
            <tbody>
              {offers.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state" style={{ padding: 24 }}><h3>لا توجد عروض</h3></div></td></tr>
              ) : offers.map((o) => (
                <tr key={o.id}>
                  <td><strong>{o.nameAr || o.name}</strong></td>
                  <td>{o.type === 'percentage' ? 'نسبة %' : 'سعر ثابت'}</td>
                  <td>{o.type === 'percentage' ? `${o.value}%` : `${o.value} د.إ`}</td>
                  <td style={{ fontSize: 12 }}>{o.startDate?.slice(0, 10)} ← {o.endDate?.slice(0, 10)}</td>
                  <td>{o.productIds?.length || 0}</td>
                  <td>
                    {o.isLive ? <span style={{ color: 'var(--green-700)', fontWeight: 700 }}>● نشط الآن</span>
                      : o.active ? <span style={{ color: 'var(--orange)' }}>مُفعّل (خارج الفترة)</span>
                        : <span className="text-muted">موقوف</span>}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-info btn-sm" onClick={() => openEdit(o)}>تعديل</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => toggle(o)}>{o.active ? 'إيقاف' : 'تفعيل'}</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(o)}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal
          title={editing._id ? 'تعديل العرض' : 'إضافة عرض جديد'}
          onClose={() => setEditing(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>إلغاء</button>
            <button className="btn btn-primary" onClick={save}>حفظ</button>
          </>}
        >
          <div className="form-group">
            <label>اسم العرض <span className="required-star">*</span></label>
            <input type="text" value={editing.nameAr} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>نوع الخصم</label>
              <select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                <option value="percentage">نسبة مئوية %</option>
                <option value="fixed_price">سعر ترويجي ثابت</option>
              </select>
            </div>
            <div className="form-group">
              <label>{editing.type === 'percentage' ? 'نسبة الخصم %' : 'السعر الترويجي (د.إ)'} <span className="required-star">*</span></label>
              <input type="number" min="0" value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>تاريخ البداية <span className="required-star">*</span></label>
              <input type="date" value={editing.startDate} onChange={(e) => setEditing({ ...editing, startDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label>تاريخ النهاية <span className="required-star">*</span></label>
              <input type="date" value={editing.endDate} onChange={(e) => setEditing({ ...editing, endDate: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>المنتجات المشمولة ({editing.productIds.length})</label>
            <select
              multiple
              value={editing.productIds}
              onChange={(e) => setEditing({ ...editing, productIds: Array.from(e.target.selectedOptions, (op) => op.value) })}
              style={{ minHeight: 160 }}
            >
              {products.map((p) => <option key={p.id} value={p.id}>{p.nameAr || p.name}</option>)}
            </select>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>اضغط Ctrl/⌘ لاختيار أكثر من منتج</div>
          </div>
          <div className="form-group">
            <label><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> مُفعّل</label>
          </div>
        </Modal>
      )}
    </>
  );
}
