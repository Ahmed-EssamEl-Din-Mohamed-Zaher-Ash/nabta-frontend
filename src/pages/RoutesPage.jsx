import { useTranslation } from 'react-i18next';
import CrudPage from '../components/CrudPage.jsx';

// Backend guards: create/update by admin + ops, delete admin-only.
export default function RoutesPage() {
  const { t } = useTranslation();
  return (
    <CrudPage
      entity="routes"
      listKey="routes"
      countLabel={(n) => t('routes.count', { count: n })}
      addLabel={t('routes.add')}
      modalTitles={{ add: t('routes.addTitle'), edit: t('routes.editTitle') }}
      messages={{
        added: t('routes.added'),
        updated: t('routes.updated'),
        deleted: t('routes.deleted'),
        confirmTitle: t('routes.confirmTitle'),
        confirmText: t('routes.confirmText'),
      }}
      editRoles={['admin', 'ops']}
      deleteRoles={['admin']}
      lookups={{ drivers: 'drivers' }}
      columns={[
        { header: t('routes.name'), render: (r) => <strong>{r.name}</strong> },
        { header: t('routes.area'), render: (r) => r.area || '-' },
        { header: t('routes.description'), render: (r) => r.description || '-' },
        { header: t('common.driver'), render: (r) => r.driver?.name || t('common.none') },
      ]}
      fields={[
        { name: 'name', label: t('routes.name'), required: true, half: true, placeholder: t('routes.namePlaceholder') },
        { name: 'area', label: t('routes.area'), half: true, placeholder: t('routes.areaPlaceholder') },
        { name: 'description', label: t('routes.description'), placeholder: t('routes.descriptionPlaceholder') },
        {
          name: 'driverId',
          label: t('routes.driverLabel'),
          type: 'select',
          lookup: 'drivers',
          optionLabel: (d) => d.name,
          placeholder: t('routes.driverPlaceholder'),
        },
        { name: 'notes', label: t('common.notes'), type: 'textarea' },
      ]}
      toPayload={(v) => ({
        name: v.name.trim(),
        area: v.area.trim(),
        description: v.description.trim() || null,
        driverId: v.driverId || null,
        notes: v.notes || null,
      })}
    />
  );
}
