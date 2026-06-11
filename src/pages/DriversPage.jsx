import CrudPage from '../components/CrudPage.jsx';

// Backend guards: create/update by admin + ops, delete admin-only.
export default function DriversPage() {
  return (
    <CrudPage
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
        {
          name: 'status',
          label: 'الحالة',
          type: 'select',
          half: true,
          default: 'active',
          options: [
            { value: 'active', label: 'نشط' },
            { value: 'inactive', label: 'غير نشط' },
          ],
        },
        { name: 'notes', label: 'ملاحظات', type: 'textarea' },
      ]}
      toPayload={(v) => ({
        name: v.name.trim(),
        phone: v.phone.trim(),
        vehicleId: v.vehicleId || null,
        status: v.status || 'active',
        notes: v.notes || null,
      })}
    />
  );
}
