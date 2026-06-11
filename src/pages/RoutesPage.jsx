import CrudPage from '../components/CrudPage.jsx';

// Backend guards: create/update by admin + ops, delete admin-only.
export default function RoutesPage() {
  return (
    <CrudPage
      entity="routes"
      listKey="routes"
      countLabel={(n) => `${n} مسار`}
      addLabel="+ إضافة مسار"
      modalTitles={{ add: 'إضافة مسار جديد', edit: 'تعديل المسار' }}
      messages={{
        added: 'تم إضافة المسار',
        updated: 'تم تعديل المسار',
        deleted: 'تم حذف المسار',
        confirmTitle: 'حذف المسار',
        confirmText: 'هل تريد حذف هذا المسار؟',
      }}
      editRoles={['admin', 'ops']}
      deleteRoles={['admin']}
      lookups={{ drivers: 'drivers' }}
      columns={[
        { header: 'اسم المسار', render: (r) => <strong>{r.name}</strong> },
        { header: 'المنطقة', render: (r) => r.area || '-' },
        { header: 'الوصف', render: (r) => r.description || '-' },
        { header: 'السائق', render: (r) => r.driver?.name || 'غير محدد' },
      ]}
      fields={[
        { name: 'name', label: 'اسم المسار', required: true, half: true, placeholder: 'مثال: مسار دبي الشمالي' },
        { name: 'area', label: 'المنطقة', half: true, placeholder: 'دبي، عجمان، أبوظبي...' },
        { name: 'description', label: 'الوصف', placeholder: 'مثال: ديرة - البر - جميرا' },
        {
          name: 'driverId',
          label: 'السائق المسؤول',
          type: 'select',
          lookup: 'drivers',
          optionLabel: (d) => d.name,
          placeholder: '-- اختر سائق --',
        },
        { name: 'notes', label: 'ملاحظات', type: 'textarea' },
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
