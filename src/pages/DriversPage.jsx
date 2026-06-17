import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CrudPage from '../components/CrudPage.jsx';
import Modal from '../components/Modal.jsx';
import api, { apiErrorMessage } from '../api/client.js';
import { useToast } from '../components/ToastHost.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Backend guards: create/update by admin + ops, delete admin-only.
// Driver status (active/inactive) is managed via the dedicated buttons below so
// the deactivation lifecycle (active-task check + force) is always enforced.
export default function DriversPage() {
  const { t } = useTranslation();
  const showToast = useToast();
  const { role } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [blocked, setBlocked] = useState(null); // { driver, check } when deactivation is blocked
  const refresh = () => setReloadKey((k) => k + 1);

  async function onDeactivate(driver) {
    try {
      const { data } = await api.get(`/api/drivers/${driver.id}/deactivation-check`);
      if (data.canDeactivate) {
        if (window.confirm(t('drivers.deactivateConfirm', { name: driver.name }))) {
          await api.put(`/api/drivers/${driver.id}`, { status: 'inactive' });
          showToast(t('drivers.deactivatedToast'), 'success');
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
    const reason = window.prompt(t('drivers.forceReasonPrompt'));
    if (reason === null) return;
    try {
      await api.put(`/api/drivers/${blocked.driver.id}`, { status: 'inactive', force: true, reason: reason || t('drivers.noReason') });
      showToast(t('drivers.forcedToast'), 'success');
      setBlocked(null);
      refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  async function onReactivate(driver) {
    try {
      await api.put(`/api/drivers/${driver.id}`, { status: 'active' });
      showToast(t('drivers.reactivatedToast'), 'success');
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
        countLabel={(n) => t('drivers.count', { count: n })}
        addLabel={t('drivers.add')}
        modalTitles={{ add: t('drivers.addTitle'), edit: t('drivers.editTitle') }}
        messages={{
          added: t('drivers.added'),
          updated: t('drivers.updated'),
          deleted: t('drivers.deleted'),
          confirmTitle: t('drivers.confirmTitle'),
          confirmText: t('drivers.confirmText'),
        }}
        editRoles={['admin', 'ops']}
        deleteRoles={['admin']}
        lookups={{ vehicles: 'vehicles' }}
        columns={[
          { header: t('common.name'), render: (d) => <strong>{d.name}</strong> },
          { header: t('common.phone'), render: (d) => d.phone || '-' },
          { header: t('drivers.vehicle'), render: (d) => d.vehicle?.plate || t('drivers.unassignedVehicle') },
          {
            header: t('common.status'),
            render: (d) => (
              <span className={`badge badge-${d.status === 'active' ? 'active' : 'inactive'}`}>
                {d.status === 'active' ? t('drivers.statusActive') : t('drivers.statusInactive')}
              </span>
            ),
          },
          {
            header: t('drivers.toggleColumn'),
            render: (d) =>
              d.status === 'active' ? (
                <button className="btn btn-warning btn-sm" onClick={() => onDeactivate(d)}>{t('drivers.deactivate')}</button>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => onReactivate(d)}>{t('drivers.activate')}</button>
              ),
          },
        ]}
        fields={[
          { name: 'name', label: t('common.name'), required: true, half: true },
          { name: 'phone', label: t('common.phone'), half: true, placeholder: '+971501234567' },
          {
            name: 'vehicleId',
            label: t('drivers.vehicle'),
            type: 'select',
            half: true,
            lookup: 'vehicles',
            optionLabel: (v) => `${v.plate} - ${v.model}`,
            placeholder: t('drivers.selectVehicle'),
          },
          { name: 'notes', label: t('common.notes'), type: 'textarea' },
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
          title={t('drivers.blockedTitle', { name: blocked.driver.name })}
          onClose={() => setBlocked(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setBlocked(null)}>{t('common.close')}</button>
              {role === 'admin' && (
                <button className="btn btn-danger" onClick={onForce}>
                  {t('drivers.forceDeactivate')}
                </button>
              )}
            </>
          }
        >
          <p style={{ marginBottom: 8 }}>
            {t('drivers.blockedIntro')}{' '}
            <strong>{t('drivers.activeOrdersCount', { count: blocked.check.activeOrdersCount })}</strong>
            {' '}{t('drivers.taskJoin')}{' '}
            <strong>{t('drivers.activeRoutesCount', { count: blocked.check.activeRoutesCount })}</strong>.
          </p>
          {blocked.check.activeOrders?.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>{t('drivers.activeOrdersLabel')}</div>
              <ul style={{ margin: '4px 0', paddingInlineStart: 18, fontSize: 13 }}>
                {blocked.check.activeOrders.map((o) => (
                  <li key={o.id}>{o.orderNumber} — {t(`status.${o.status}`, o.status)}</li>
                ))}
              </ul>
            </>
          )}
          {blocked.check.activeRoutes?.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>{t('drivers.activeRoutesLabel')}</div>
              <ul style={{ margin: '4px 0', paddingInlineStart: 18, fontSize: 13 }}>
                {blocked.check.activeRoutes.map((r) => <li key={r.id}>{r.name}</li>)}
              </ul>
            </>
          )}
          <p className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
            {t('drivers.blockedHint')}
          </p>
        </Modal>
      )}
    </>
  );
}
