import { useTranslation } from 'react-i18next';
import CrudPage from '../components/CrudPage.jsx';

// Backend guards: create/update by admin + sales, delete admin-only.
export default function CustomersPage() {
  const { t } = useTranslation();
  return (
    <CrudPage
      entity="customers"
      listKey="customers"
      countLabel={(n) => t('customers.count', { count: n })}
      addLabel={t('customers.add')}
      modalTitles={{ add: t('customers.addTitle'), edit: t('customers.editTitle') }}
      messages={{
        added: t('customers.added'),
        updated: t('customers.updated'),
        deleted: t('customers.deleted'),
        confirmTitle: t('customers.confirmTitle'),
        confirmText: t('customers.confirmText'),
      }}
      editRoles={['admin', 'sales']}
      deleteRoles={['admin']}
      columns={[
        { header: t('common.name'), render: (c) => <strong>{c.name}</strong> },
        { header: t('common.phone'), render: (c) => c.phone || '-' },
        { header: t('common.email'), render: (c) => c.email || '-' },
        { header: t('common.address'), render: (c) => c.address || '-' },
        {
          header: t('common.location'),
          render: (c) =>
            c.location?.lat ? (
              <span style={{ color: 'var(--green-600)' }}>
                <i className="fa-solid fa-location-dot" aria-hidden="true" /> {t('common.locationSet')}
              </span>
            ) : (
              <span className="text-muted">{t('common.locationNotSet')}</span>
            ),
        },
      ]}
      fields={[
        { name: 'name', label: t('common.name'), required: true, half: true },
        { name: 'phone', label: t('common.phone'), half: true, placeholder: '+971501234567' },
        { name: 'email', label: t('common.email'), type: 'email', half: true },
        {
          name: 'preferredLanguage',
          label: t('common.messagingLang'),
          type: 'select',
          half: true,
          default: 'ar',
          options: [{ value: 'ar', label: t('lang.ar') }, { value: 'en', label: t('lang.en') }],
        },
        { name: 'address', label: t('common.address') },
        { name: 'location', label: t('common.locationOnMap'), type: 'location' },
        { name: 'notes', label: t('common.notes'), type: 'textarea' },
      ]}
      toPayload={(v) => ({
        name: v.name.trim(),
        phone: v.phone.trim(),
        email: v.email.trim(),
        address: v.address.trim(),
        preferredLanguage: v.preferredLanguage || 'ar',
        // location is a required Json column in the schema
        location: v.location?.lat ? v.location : { lat: null, lng: null, address: v.address.trim() },
        notes: v.notes || null,
      })}
    />
  );
}
