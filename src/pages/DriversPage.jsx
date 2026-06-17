import { useState } from 'react';
import CrudPage from '../components/CrudPage.jsx';
import Modal from '../components/Modal.jsx';
import api, { apiErrorMessage } from '../api/client.js';
import { useToast } from '../components/ToastHost.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { STATUS_LABELS } from '../constants/permissions.js';

// Backend guards: create/update by admin + ops, delete admin-only.
// Driver status (active/inactive) is managed via the dedicated buttons below so
// the deactivation lifecycle (active-task check + force) is always enforced.
export default function DriversPage() {
  const showToast = useToast();
  const { role } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [blocked, setBlocked] = useState(null); // { driver, check } when deactivation is blocked
  const refresh = () => setReloadKey((k) => k + 1);

  async function onDeactivate(driver) {
    try {
      const { data } = await api.get(`/api/drivers/${driver.id}/deactivation-check`);
      if (data.canDeactivate) {
        if (window.confirm(`تعطيل السائق "${driver.name}"؟ سيتم تعطيل حساب دخوله أيضاً.`)) {
          await api.put(`/api/drivers/${driver.id}`, { status: 'inactive' });
          showToast('تم تعطيل السائق وتعطيل حساب دخوله', 'success');
          refresh();
        }
      } else {
        setBlocked({ driver, check: data });
      }
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  async function onForce() {
    const reason = window.prompt('سبب التعطيل الإجباري (سيتم إلغاء إسناد المهام النشطة):');
    if (reason === null) return;
    try {
      await api.put(`/api/drivers/${blocked.driver.id}`, { status: 'inactive', force: true, reason: reason || 'بدون سبب' });
      showToast('تم التعطيل الإجباري وإلغاء إسناد المهام', 'success');
      setBlocked(null);
      refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  async function onReactivate(driver) {
    try {
      await api.put(`/api/drivers/${driver.id}`, { status: 'active' });
      showToast('تم تفعيل السائق. ملاحظة: حساب الدخول يبقى معطّلاً حتى يفعّله المدير من شاشة المستخدمين.', 'success');
      refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  return (
    <>
      <CrudPage
        key={reloadKey}
        entity="drivers"
        listKey="drivers"
        countLabel={(n) => `${n} سائق`}
        addLabel="+ إضافة سائق"
        modalTitles={{ add: 'إضافة سائق جديد', edit: 'تعديل السائق' }}
        messages={{
          added: 'تم إضافة السائق',
          updated: 'تم تعديل السائق',
          deleted: 'تم حذف السائق',
          confirmTitle: 'حذف السائق',
          confirmText: 'هل تريد حذف هذا السائق؟',
        }}
        editRoles={['admin', 'ops']}
        deleteRoles={['admin']}
        lookups={{ vehicles: 'vehicles' }}
        columns={[
          { header: 'الاسم', render: (d) => <strong>{d.name}</strong> },
          { header: 'الهاتف', render: (d) => d.phone || '-' },
          { header: 'المركبة', render: (d) => d.vehicle?.plate || 'غير محددة' },
          {
            header: 'الحالة',
            render: (d) => (
              <span className={`badge badge-${d.status === 'active' ? 'active' : 'inactive'}`}>
                {d.status === 'active' ? 'نشط' : 'غير نشط'}
              </span>
            ),
          },
          {
            header: 'تعطيل/تفعيل',
            render: (d) =>
              d.status === 'active' ? (
                <button className="btn btn-warning btn-sm" onClick={() => onDeactivate(d)}>تعطيل</button>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => onReactivate(d)}>تفعيل</button>
              ),
          },
        ]}
        fields={[
          { name: 'name', label: 'الاسم', required: true, half: true },
          { name: 'phone', label: 'الهاتف', half: true, placeholder: '+971501234567' },
          {
            name: 'vehicleId',
            label: 'المركبة',
            type: 'select',
            half: true,
            lookup: 'vehicles',
            optionLabel: (v) => `${v.plate} - ${v.model}`,
            placeholder: '-- اختر مركبة --',
          },
          { name: 'notes', label: 'ملاحظات', type: 'textarea' },
        ]}
        toPayload={(v) => ({
          name: v.name.trim(),
          phone: v.phone.trim(),
          vehicleId: v.vehicleId || null,
          notes: v.notes || null,
          // status is managed via the تعطيل/تفعيل buttons (lifecycle-checked), not the form
        })}
      />

      {blocked && (
        <Modal
          title={`تعذّر تعطيل: ${blocked.driver.name}`}
          onClose={() => setBlocked(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setBlocked(null)}>إغلاق</button>
              {role === 'admin' && (
                <button className="btn btn-danger" onClick={onForce}>
                  تعطيل إجباري وإلغاء الإسناد
                </button>
              )}
            </>
          }
        >
          <p style={{ marginBottom: 8 }}>
            لا يمكن تعطيل السائق قبل إعادة إسناد مهامه النشطة:
            <strong> {blocked.check.activeOrdersCount} طلب</strong> و
            <strong> {blocked.check.activeRoutesCount} مسار</strong>.
          </p>
          {blocked.check.activeOrders?.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>الطلبات النشطة:</div>
              <ul style={{ margin: '4px 0', paddingInlineStart: 18, fontSize: 13 }}>
                {blocked.check.activeOrders.map((o) => (
                  <li key={o.id}>{o.orderNumber} — {STATUS_LABELS[o.status] || o.status}</li>
                ))}
              </ul>
            </>
          )}
          {blocked.check.activeRoutes?.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>المسارات النشطة:</div>
              <ul style={{ margin: '4px 0', paddingInlineStart: 18, fontSize: 13 }}>
                {blocked.check.activeRoutes.map((r) => <li key={r.id}>{r.name}</li>)}
              </ul>
            </>
          )}
          <p className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
            أعد إسناد هذه المهام إلى سائق آخر ثم أعد المحاولة، أو استخدم التعطيل الإجباري (للمدير) لإلغاء الإسناد تلقائياً.
          </p>
        </Modal>
      )}
    </>
  );
}
