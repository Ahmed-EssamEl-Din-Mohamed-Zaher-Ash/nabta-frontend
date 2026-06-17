import CrudPage from '../components/CrudPage.jsx';

// Backend guards: create/update by admin + sales, delete admin-only.
export default function CustomersPage() {
  return (
    <CrudPage
      entity="customers"
      listKey="customers"
      countLabel={(n) => `${n} عميل`}
      addLabel="+ إضافة عميل"
      modalTitles={{ add: 'إضافة عميل جديد', edit: 'تعديل العميل' }}
      messages={{
        added: 'تم إضافة العميل',
        updated: 'تم تعديل العميل',
        deleted: 'تم حذف العميل',
        confirmTitle: 'حذف العميل',
        confirmText: 'هل تريد حذف هذا العميل؟',
      }}
      editRoles={['admin', 'sales']}
      deleteRoles={['admin']}
      columns={[
        { header: 'الاسم', render: (c) => <strong>{c.name}</strong> },
        { header: 'الهاتف', render: (c) => c.phone || '-' },
        { header: 'البريد', render: (c) => c.email || '-' },
        { header: 'العنوان', render: (c) => c.address || '-' },
        {
          header: 'الموقع',
          render: (c) =>
            c.location?.lat ? (
              <span style={{ color: 'var(--green-600)' }}>
                <i className="fa-solid fa-location-dot" aria-hidden="true" /> محدد
              </span>
            ) : (
              <span className="text-muted">غير محدد</span>
            ),
        },
      ]}
      fields={[
        { name: 'name', label: 'الاسم', required: true, half: true },
        { name: 'phone', label: 'الهاتف', half: true, placeholder: '+971501234567' },
        { name: 'email', label: 'البريد الإلكتروني', type: 'email', half: true },
        {
          name: 'preferredLanguage',
          label: 'لغة المراسلة والفواتير',
          type: 'select',
          half: true,
          default: 'ar',
          options: [{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'الإنجليزية' }],
        },
        { name: 'address', label: 'العنوان' },
        { name: 'location', label: 'الموقع على الخريطة', type: 'location' },
        { name: 'notes', label: 'ملاحظات', type: 'textarea' },
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
