import CrudPage from '../components/CrudPage.jsx';

// Backend guards: create/update by admin + ops, delete admin-only.
export default function VehiclesPage() {
  return (
    <CrudPage
      entity="vehicles"
      listKey="vehicles"
      countLabel={(n) => `${n} مركبة`}
      addLabel="+ إضافة مركبة"
      modalTitles={{ add: 'إضافة مركبة جديدة', edit: 'تعديل المركبة' }}
      messages={{
        added: 'تم إضافة المركبة',
        updated: 'تم تعديل المركبة',
        deleted: 'تم حذف المركبة',
        confirmTitle: 'حذف المركبة',
        confirmText: 'هل تريد حذف هذه المركبة؟',
      }}
      editRoles={['admin', 'ops']}
      deleteRoles={['admin']}
      lookups={{ drivers: 'drivers' }}
      columns={[
        { header: 'اللوحة', render: (v) => <strong>{v.plate}</strong> },
        { header: 'النوع', render: (v) => v.type || '-' },
        { header: 'الموديل', render: (v) => v.model || '-' },
        { header: 'اللون', render: (v) => v.color || '-' },
        { header: 'السائق', render: (v) => v.driver?.name || 'غير محدد' },
        {
          header: 'الحالة',
          render: (v) => (
            <span className={`badge badge-${v.status === 'active' ? 'active' : 'inactive'}`}>
              {v.status === 'active' ? 'نشطة' : 'غير نشطة'}
            </span>
          ),
        },
      ]}
      fields={[
        { name: 'plate', label: 'رقم اللوحة', required: true, half: true, placeholder: 'دبي أ 12345' },
        { name: 'type', label: 'نوع المركبة', half: true, placeholder: 'شاحنة، فان، سيارة' },
        { name: 'model', label: 'الموديل', half: true, placeholder: 'Toyota Hilux 2022' },
        { name: 'color', label: 'اللون', half: true },
        {
          name: 'driverId',
          label: 'السائق المسؤول',
          type: 'select',
          half: true,
          lookup: 'drivers',
          optionLabel: (d) => d.name,
          placeholder: '-- اختر سائق --',
        },
        {
          name: 'status',
          label: 'الحالة',
          type: 'select',
          half: true,
          default: 'active',
          options: [
            { value: 'active', label: 'نشطة' },
            { value: 'inactive', label: 'غير نشطة' },
          ],
        },
        { name: 'notes', label: 'ملاحظات', type: 'textarea' },
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
