import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { apiErrorMessage } from '../api/client.js';
import { useToast } from '../components/ToastHost.jsx';
import Modal from '../components/Modal.jsx';

const emptyForm = { _id: null, name: '', nameAr: '', type: 'percentage', value: '', startDate: '', endDate: '', active: true, productIds: [] };

export default function OffersPage() {
  const { t } = useTranslation();
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
    if (!f.nameAr.trim()) return showToast(t('offers.validation.name'), 'error');
    if (!f.startDate || !f.endDate) return showToast(t('offers.validation.period'), 'error');
    if (f.value === '' || Number.isNaN(Number(f.value))) return showToast(t('offers.validation.value'), 'error');
    const payload = {
      name: f.name.trim() || f.nameAr.trim(), nameAr: f.nameAr.trim(), type: f.type,
      value: Number(f.value), startDate: f.startDate, endDate: f.endDate, active: f.active, productIds: f.productIds,
    };
    try {
      if (f._id) await api.put(`/api/offers/${f._id}`, payload);
      else await api.post('/api/offers', payload);
      showToast(t('offers.saved'), 'success');
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
    if (!window.confirm(t('offers.confirmDelete'))) return;
    try { await api.delete(`/api/offers/${o.id}`); showToast(t('offers.deleted'), 'success'); load(); }
    catch (err) { showToast(apiErrorMessage(err), 'error'); }
  }

  if (!offers) return <div className="loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-toolbar">
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('offers.title')}</h3>
        <button className="btn btn-primary" onClick={() => setEditing({ ...emptyForm })}>+ {t('offers.add')}</button>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>{t('offers.col.offer')}</th><th>{t('offers.col.type')}</th><th>{t('offers.col.value')}</th><th>{t('offers.col.period')}</th><th>{t('offers.col.products')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr>
            </thead>
            <tbody>
              {offers.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state" style={{ padding: 24 }}><h3>{t('offers.empty')}</h3></div></td></tr>
              ) : offers.map((o) => (
                <tr key={o.id}>
                  <td><strong>{o.nameAr || o.name}</strong></td>
                  <td>{o.type === 'percentage' ? t('offers.type.percentage') : t('offers.type.fixed')}</td>
                  <td>{o.type === 'percentage' ? `${o.value}%` : `${o.value} ${t('offers.currency')}`}</td>
                  <td style={{ fontSize: 12 }}>{o.startDate?.slice(0, 10)} ← {o.endDate?.slice(0, 10)}</td>
                  <td>{o.productIds?.length || 0}</td>
                  <td>
                    {o.isLive ? <span style={{ color: 'var(--green-700)', fontWeight: 700 }}>● {t('offers.live')}</span>
                      : o.active ? <span style={{ color: 'var(--orange)' }}>{t('offers.activeOutOfPeriod')}</span>
                        : <span className="text-muted">{t('offers.stopped')}</span>}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-info btn-sm" onClick={() => openEdit(o)}>{t('common.edit')}</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => toggle(o)}>{o.active ? t('offers.deactivate') : t('offers.activate')}</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(o)}>{t('common.delete')}</button>
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
          title={editing._id ? t('offers.editTitle') : t('offers.addTitle')}
          onClose={() => setEditing(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={save}>{t('common.save')}</button>
          </>}
        >
          <div className="form-group">
            <label>{t('offers.field.name')} <span className="required-star">*</span></label>
            <input type="text" value={editing.nameAr} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('offers.field.discountType')}</label>
              <select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                <option value="percentage">{t('offers.option.percentage')}</option>
                <option value="fixed_price">{t('offers.option.fixedPrice')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{editing.type === 'percentage' ? t('offers.field.discountPercent') : t('offers.field.promoPrice')} <span className="required-star">*</span></label>
              <input type="number" min="0" value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('offers.field.startDate')} <span className="required-star">*</span></label>
              <input type="date" value={editing.startDate} onChange={(e) => setEditing({ ...editing, startDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label>{t('offers.field.endDate')} <span className="required-star">*</span></label>
              <input type="date" value={editing.endDate} onChange={(e) => setEditing({ ...editing, endDate: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>{t('offers.field.includedProducts', { count: editing.productIds.length })}</label>
            <select
              multiple
              value={editing.productIds}
              onChange={(e) => setEditing({ ...editing, productIds: Array.from(e.target.selectedOptions, (op) => op.value) })}
              style={{ minHeight: 160 }}
            >
              {products.map((p) => <option key={p.id} value={p.id}>{p.nameAr || p.name}</option>)}
            </select>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{t('offers.multiSelectHint')}</div>
          </div>
          <div className="form-group">
            <label><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> {t('offers.active')}</label>
          </div>
        </Modal>
      )}
    </>
  );
}
