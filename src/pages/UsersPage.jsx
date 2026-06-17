import CrudPage from '../components/CrudPage.jsx';
import { ROLE_LABELS } from '../constants/permissions.js';

// Admin-only users & roles management, backed by /api/users.
// The backend hashes passwords with bcrypt; an empty password on edit keeps
// the existing one (the payload simply omits the key).
const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

export default function UsersPage() {
  return (
    <CrudPage
      entity="users"
      listKey="users"
      countLabel={(n) => `${n} مستخدم`}
      addLabel="+ إضافة مستخدم"
      modalTitles={{ add: 'إضافة مستخدم جديد', edit: 'تعديل المستخدم' }}
      messages={{
        added: 'تم إضافة المستخدم',
        updated: 'تم تعديل المستخدم',
        deleted: 'تم حذف المستخدم',
        confirmTitle: 'حذف المستخدم',
        confirmText: 'هل تريد حذف هذا المستخدم؟ لن يتمكن من تسجيل الدخول بعد الآن.',
      }}
      editRoles={['admin']}
      deleteRoles={['admin']}
      lookups={{ 'available-drivers': 'available-drivers' }}
      columns={[
        { header: 'الاسم', render: (u) => <strong>{u.name}</strong> },
        { header: 'البريد الإلكتروني', render: (u) => <span dir="ltr">{u.email}</span> },
        {
          header: 'الصلاحية',
          render: (u) => <span className="badge badge-confirmed">{ROLE_LABELS[u.role] || u.role}</span>,
        },
        {
          header: 'مفعل',
          render: (u) => (
            <span className={`badge badge-${u.active ? 'active' : 'inactive'}`}>
              {u.active ? 'نعم' : 'لا'}
            </span>
          ),
        },
      ]}
      fields={[
        { name: 'name', label: 'الاسم', required: true, half: true },
        { name: 'email', label: 'البريد الإلكتروني', type: 'email', required: true, half: true },
        {
          name: 'password',
          label: 'كلمة المرور',
          type: 'password',
          requiredOnCreate: true,
          placeholder: '6 أحرف على الأقل',
          hint: 'عند التعديل: اتركها فارغة للإبقاء على كلمة المرور الحالية',
        },
        {
          name: 'role',
          label: 'الصلاحية',
          type: 'select',
          required: true,
          half: true,
          default: 'sales',
          options: ROLE_OPTIONS,
        },
        {
          name: 'active',
          label: 'مفعل',
          type: 'select',
          half: true,
          default: 'true',
          options: [
            { value: 'true', label: 'نعم' },
            { value: 'false', label: 'لا' },
          ],
          fromItem: (u) => (u.active ? 'true' : 'false'),
        },
        {
          name: 'driverId',
          label: 'السائق المرتبط بالحساب',
          type: 'select',
          required: true,
          showIf: (v) => v.role === 'driver',
          placeholder: '— اختر السائق —',
          hint: 'إلزامي لحسابات السائقين — تظهر فقط السجلات النشطة غير المرتبطة بحساب آخر',
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
