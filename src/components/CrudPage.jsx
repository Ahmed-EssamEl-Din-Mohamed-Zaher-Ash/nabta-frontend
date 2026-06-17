import { useCallback, useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './ToastHost.jsx';
import Modal from './Modal.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import MapPickerModal from './MapPickerModal.jsx';

/**
 * Config-driven CRUD page used by all six master-data screens.
 *
 * Props:
 * - entity: API path segment → GET/POST /api/<entity>, PUT/DELETE /api/<entity>/:id
 * - listKey: key of the array in the GET response ({ products: [...] })
 * - countLabel: (n) => Arabic counter text for the toolbar
 * - addLabel / modalTitles {add, edit} / messages {added, updated, deleted, confirmTitle, confirmText}
 * - editRoles / deleteRoles: roles allowed to mutate — MUST mirror the backend's
 *   authorizeRoles guards, otherwise the UI offers buttons that 403.
 * - columns: [{ header, render(item) }]
 * - fields: form schema; consecutive fields with `half: true` are paired into .form-row
 *   { name, label, type?: text|number|email|textarea|select, required?, placeholder?,
 *     hint?, half?, default?, options? [{value,label}], lookup?: entityName, optionLabel?(item) }
 * - lookups: { name: apiPath } extra lists fetched for selects (e.g. { vendors: 'vendors' })
 * - toPayload: (values) => request body (parse numbers, null empty FKs, etc.)
 * - viewModal?: (item) => JSX — read-only details for roles without edit rights
 */
export default function CrudPage({
  entity,
  listKey,
  countLabel,
  addLabel,
  modalTitles,
  messages,
  editRoles,
  deleteRoles,
  columns,
  fields,
  lookups = {},
  toPayload = (v) => v,
  viewModal,
  toolbarExtra, // optional ({ refresh }) => JSX, rendered next to the add button for edit roles
}) {
  const { role } = useAuth();
  const showToast = useToast();

  const [items, setItems] = useState([]);
  const [lookupData, setLookupData] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { item: null | record }
  const [values, setValues] = useState({});
  const [viewed, setViewed] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pickingField, setPickingField] = useState(null); // field name being map-picked

  const canEdit = editRoles.includes(role);
  const canDelete = deleteRoles.includes(role);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const lookupNames = Object.keys(lookups);
      const [listRes, ...lookupRes] = await Promise.all([
        api.get(`/api/${entity}`),
        ...lookupNames.map((n) => api.get(`/api/${lookups[n]}`)),
      ]);
      setItems(listRes.data[listKey]);
      const ld = {};
      lookupNames.forEach((n, i) => {
        ld[n] = lookupRes[i].data[lookups[n]];
      });
      setLookupData(ld);
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function openForm(item = null) {
    const v = {};
    for (const f of fields) {
      if (f.type === 'location') {
        v[f.name] = item?.[f.name]?.lat ? item[f.name] : null;
      } else if (item) {
        v[f.name] = f.fromItem ? f.fromItem(item) : (item[f.name] ?? '');
      } else {
        v[f.name] = f.default ?? '';
      }
    }
    setValues(v);
    setEditing({ item });
  }

  async function save() {
    const isCreate = !editing.item;
    for (const f of fields) {
      if (f.showIf && !f.showIf(values)) continue; // hidden fields aren't required
      const required = f.required || (isCreate && f.requiredOnCreate);
      if (required && f.type !== 'location' && !String(values[f.name] ?? '').trim()) {
        showToast('يرجى ملء الحقول المطلوبة', 'error');
        return;
      }
    }
    setSaving(true);
    try {
      const body = toPayload(values);
      if (editing.item) {
        await api.put(`/api/${entity}/${editing.item.id}`, body);
        showToast(messages.updated, 'success');
      } else {
        await api.post(`/api/${entity}`, body);
        showToast(messages.added, 'success');
      }
      setEditing(null);
      fetchAll();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api.delete(`/api/${entity}/${deleting.id}`);
      showToast(messages.deleted, 'success');
      setDeleting(null);
      fetchAll();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
      setDeleting(null);
    }
  }

  function renderField(f) {
    // Conditional fields (e.g. driver link shown only for the driver role).
    if (f.showIf && !f.showIf(values)) return null;
    const common = {
      value: values[f.name] ?? '',
      onChange: (e) => setValues((v) => ({ ...v, [f.name]: e.target.value })),
    };
    return (
      <div className="form-group" key={f.name}>
        <label>
          {f.label} {f.required && <span className="required-star">*</span>}
        </label>
        {f.type === 'location' ? (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                readOnly
                placeholder="لم يتم تحديد الموقع"
                value={values[f.name]?.address || ''}
                style={{ flex: 1, background: 'var(--gray-50)', cursor: 'pointer' }}
                onClick={() => setPickingField(f.name)}
              />
              <button type="button" className="btn btn-secondary" onClick={() => setPickingField(f.name)}>
                <i className="fa-solid fa-location-dot" aria-hidden="true" /> خريطة
              </button>
            </div>
            {values[f.name]?.lat && (
              <div className="location-display">
                <i className="fa-solid fa-location-dot" aria-hidden="true" /> {values[f.name].address}
              </div>
            )}
          </>
        ) : f.type === 'textarea' ? (
          <textarea {...common} placeholder={f.placeholder} />
        ) : f.type === 'select' ? (
          <select {...common}>
            <option value="">{f.placeholder || '-- اختر --'}</option>
            {(typeof f.options === 'function'
              ? f.options(values, lookupData)
              : (f.options || (lookupData[f.lookup] || []).map((it) => ({ value: it.id, label: f.optionLabel(it) })))
            ).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <input
            type={f.type || 'text'}
            placeholder={f.placeholder}
            min={f.type === 'number' ? 0 : undefined}
            step={f.step}
            {...common}
          />
        )}
        {f.hint && <div className="input-hint">{f.hint}</div>}
      </div>
    );
  }

  // Pair consecutive `half` fields into .form-row, like the legacy forms
  const fieldRows = [];
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].half && fields[i + 1]?.half) {
      fieldRows.push([fields[i], fields[i + 1]]);
      i++;
    } else {
      fieldRows.push([fields[i]]);
    }
  }

  return (
    <>
      <div className="page-toolbar">
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{countLabel(items.length)}</h3>
        {canEdit && (
          <div className="toolbar-right">
            <button className="btn btn-primary" onClick={() => openForm()}>{addLabel}</button>
            {toolbarExtra && toolbarExtra({ refresh: fetchAll })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {columns.map((c) => <th key={c.header}>{c.header}</th>)}
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 1}><div className="loading"><div className="spinner" /></div></td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: 20, color: 'var(--gray-400)' }}>
                    لا توجد بيانات
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    {columns.map((c) => <td key={c.header}>{c.render(item)}</td>)}
                    <td>
                      <div className="table-actions">
                        {canEdit && (
                          <button className="btn btn-warning btn-sm" onClick={() => openForm(item)}>تعديل</button>
                        )}
                        {canDelete && (
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleting(item)}>حذف</button>
                        )}
                        {!canEdit && viewModal && (
                          <button className="btn btn-info btn-sm" onClick={() => setViewed(item)}>عرض</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal
          title={editing.item ? modalTitles.edit : modalTitles.add}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>إلغاء</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'جارٍ الحفظ…' : 'حفظ'}
              </button>
            </>
          }
        >
          {fieldRows.map((row, idx) =>
            row.length === 2 ? (
              <div className="form-row" key={idx}>{row.map(renderField)}</div>
            ) : (
              renderField(row[0])
            )
          )}
        </Modal>
      )}

      {viewed && viewModal && (
        <Modal
          title={viewed.nameAr || viewed.name}
          onClose={() => setViewed(null)}
          footer={<button className="btn btn-secondary" onClick={() => setViewed(null)}>إغلاق</button>}
        >
          {viewModal(viewed)}
        </Modal>
      )}

      {pickingField && (
        <MapPickerModal
          initial={values[pickingField]}
          onClose={() => setPickingField(null)}
          onPick={(loc) => {
            setValues((v) => ({ ...v, [pickingField]: loc }));
            setPickingField(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={messages.confirmTitle}
          text={messages.confirmText}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
