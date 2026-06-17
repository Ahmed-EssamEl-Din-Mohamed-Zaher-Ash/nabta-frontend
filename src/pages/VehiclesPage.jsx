import { useTranslation } from 'react-i18next';
import CrudPage from '../components/CrudPage.jsx';

// Backend guards: create/update by admin + ops, delete admin-only.
export default function VehiclesPage() {
  const { t } = useTranslation();
  return (
    <CrudPage
      entity="vehicles"
      listKey="vehicles"
      countLabel={(n) => t('vehicles.count', { count: n })}
      addLabel={t('vehicles.add')}
      modalTitles={{ add: t('vehicles.addTitle'), edit: t('vehicles.editTitle') }}
      messages={{
        added: t('vehicles.added'),
        updated: t('vehicles.updated'),
        deleted: t('vehicles.deleted'),
        confirmTitle: t('vehicles.confirmTitle'),
        confirmText: t('vehicles.confirmText'),
      }}
      editRoles={['admin', 'ops']}
      deleteRoles={['admin']}
      lookups={{ drivers: 'drivers' }}
      columns={[
        { header: t('vehicles.plate'), render: (v) => <strong>{v.plate}</strong> },
        { header: t('vehicles.type'), render: (v) => v.type || '-' },
        { header: t('vehicles.model'), render: (v) => v.model || '-' },
        { header: t('vehicles.color'), render: (v) => v.color || '-' },
        { header: t('common.driver'), render: (v) => v.driver?.name || t('common.none') },
        {
          header: t('common.status'),
          render: (v) => (
            <span className={`badge badge-${v.status === 'active' ? 'active' : 'inactive'}`}>
              {v.status === 'active' ? t('vehicles.active') : t('vehicles.inactive')}
            </span>
          ),
        },
      ]}
      fields={[
        { name: 'plate', label: t('vehicles.plateNumber'), required: true, half: true, placeholder: t('vehicles.platePlaceholder') },
        { name: 'type', label: t('vehicles.vehicleType'), half: true, placeholder: t('vehicles.typePlaceholder') },
        { name: 'model', label: t('vehicles.model'), half: true, placeholder: t('vehicles.modelPlaceholder') },
        { name: 'color', label: t('vehicles.color'), half: true },
        {
          name: 'driverId',
          label: t('vehicles.assignedDriver'),
          type: 'select',
          half: true,
          lookup: 'drivers',
          optionLabel: (d) => d.name,
          placeholder: t('vehicles.selectDriver'),
        },
        {
          name: 'status',
          label: t('common.status'),
          type: 'select',
          half: true,
          default: 'active',
          options: [
            { value: 'active', label: t('vehicles.active') },
            { value: 'inactive', label: t('vehicles.inactive') },
          ],
        },
        { name: 'notes', label: t('common.notes'), type: 'textarea' },
      ]}
      toPayload={(v) => ({
        plate: v.plate.trim(),
        type: v.type.trim(),
        model: v.model.trim(),
        color: v.color.trim(),
        driverId: v.driverId || null,
        status: v.status || 'active',
        notes: v.notes || null,
      })}
    />
  );
}
