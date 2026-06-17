import { useTranslation } from 'react-i18next';
import CrudPage from '../components/CrudPage.jsx';
import { ROLE_LABELS } from '../constants/permissions.js';

// Admin-only users & roles management, backed by /api/users.
// The backend hashes passwords with bcrypt; an empty password on edit keeps
// the existing one (the payload simply omits the key).

export default function UsersPage() {
  const { t } = useTranslation();
  const ROLE_OPTIONS = Object.keys(ROLE_LABELS).map((value) => ({ value, label: t(`roles.${value}`) }));

  return (
    <CrudPage
      entity="users"
      listKey="users"
      countLabel={(n) => t('users.count', { count: n })}
      addLabel={t('users.add')}
      modalTitles={{ add: t('users.addTitle'), edit: t('users.editTitle') }}
      messages={{
        added: t('users.added'),
        updated: t('users.updated'),
        deleted: t('users.deleted'),
        confirmTitle: t('users.confirmTitle'),
        confirmText: t('users.confirmText'),
      }}
      editRoles={['admin']}
      deleteRoles={['admin']}
      lookups={{ 'available-drivers': 'available-drivers' }}
      columns={[
        { header: t('common.name'), render: (u) => <strong>{u.name}</strong> },
        { header: t('common.email'), render: (u) => <span dir="ltr">{u.email}</span> },
        {
          header: t('users.role'),
          render: (u) => <span className="badge badge-confirmed">{t(`roles.${u.role}`)}</span>,
        },
        {
          header: t('users.active'),
          render: (u) => (
            <span className={`badge badge-${u.active ? 'active' : 'inactive'}`}>
              {u.active ? t('common.yes') : t('common.no')}
            </span>
          ),
        },
      ]}
      fields={[
        { name: 'name', label: t('common.name'), required: true, half: true },
        { name: 'email', label: t('common.email'), type: 'email', required: true, half: true },
        {
          name: 'password',
          label: t('users.password'),
          type: 'password',
          requiredOnCreate: true,
          placeholder: t('users.passwordPlaceholder'),
          hint: t('users.passwordHint'),
        },
        {
          name: 'role',
          label: t('users.role'),
          type: 'select',
          required: true,
          half: true,
          default: 'sales',
          options: ROLE_OPTIONS,
        },
        {
          name: 'active',
          label: t('users.active'),
          type: 'select',
          half: true,
          default: 'true',
          options: [
            { value: 'true', label: t('common.yes') },
            { value: 'false', label: t('common.no') },
          ],
          fromItem: (u) => (u.active ? 'true' : 'false'),
        },
        {
          name: 'driverId',
          label: t('users.linkedDriver'),
          type: 'select',
          required: true,
          showIf: (v) => v.role === 'driver',
          placeholder: t('users.selectDriver'),
          hint: t('users.driverHint'),
          fromItem: (u) => u.driverId || '',
          options: (values, lookupData) =>
            (lookupData['available-drivers'] || [])
              .filter((d) => !d.linkedProfileId || d.id === values.driverId)
              .map((d) => ({ value: d.id, label: `${d.name} — ${d.phone || '—'}` })),
        },
      ]}
      toPayload={(v) => ({
        name: v.name.trim(),
        email: v.email.trim(),
        role: v.role,
        active: v.active === 'true',
        // driver accounts must carry a driver link; other roles never do
        driverId: v.role === 'driver' ? (v.driverId || null) : null,
        // omit the key entirely when blank → backend keeps the old hash
        ...(v.password ? { password: v.password } : {}),
      })}
    />
  );
}
