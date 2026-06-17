import { useState } from 'react';
import CrudPage from '../components/CrudPage.jsx';
import ExcelImportModal from '../components/ExcelImportModal.jsx';

// Account & finance can open this page read-only (عرض); only admin mutates.
// Note: the Vendor model has no `location` field, so unlike legacy we never
// send one (Prisma rejects unknown fields).
export default function VendorsPage() {
  const [importing, setImporting] = useState(null); // { refresh } when open

  return (
    <>
      {importing && (
        <ExcelImportModal
          title="استيراد الموردين من Excel"
          bulkEndpoint="/api/vendors/bulk"
          mapperName="mapExcelRowToVendor"
          templateName="downloadVendorsTemplate"
          itemNoun="مورد"
          columnsHint="الأعمدة المدعومة: الاسم بالعربي، الاسم بالإنجليزي، الهاتف، البريد، العنوان، اسم البنك، IBAN، رقم الحساب، اسم صاحب الحساب، شروط الدفع (أيام)، نسبة العمولة، لغة المراسلة، ملاحظات"
          onClose={() => setImporting(null)}
          onImported={importing.refresh}
        />
      )}
    <CrudPage
      toolbarExtra={({ refresh }) => (
        <button className="btn btn-secondary" onClick={() => setImporting({ refresh })}>
          <i className="fa-solid fa-file-excel" aria-hidden="true" /> استيراد Excel
        </button>
      )}
      entity="vendors"
      listKey="vendors"
      countLabel={(n) => `${n} مورد`}
      addLabel="+ إضافة مورد"
      modalTitles={{ add: 'إضافة مورد جديد', edit: 'تعديل المورد' }}
      messages={{
        added: 'تم إضافة المورد',
        updated: 'تم تعديل المورد',
        deleted: 'تم حذف المورد',
        confirmTitle: 'حذف المورد',
        confirmText: 'هل تريد حذف هذا المورد؟',
      }}
      editRoles={['admin', 'account']}
      deleteRoles={['admin']}
      columns={[
        {
          header: 'اسم المورد',
          render: (v) => (
            <>
              <strong>{v.nameAr || v.name}</strong>
              <br />
              <span className="text-muted">{v.name}</span>
            </>
          ),
        },
        { header: 'الهاتف', render: (v) => v.phone || '-' },
        { header: 'البريد', render: (v) => v.email || '-' },
        { header: 'البنك', render: (v) => v.bankName || '-' },
        {
          header: 'IBAN',
          render: (v) => (
            <span style={{ direction: 'ltr', fontFamily: 'monospace', fontSize: 11 }}>{v.iban || '-'}</span>
          ),
        },
        {
          header: 'شروط الدفع',
          render: (v) =>
            v.payoutTerms === 0 ? (
              <span className="badge badge-confirmed">فوري</span>
            ) : (
              <span className="badge badge-preparing">بعد {v.payoutTerms} يوم</span>
            ),
        },
      ]}
      fields={[
        { name: 'nameAr', label: 'الاسم بالعربي', required: true, half: true, placeholder: 'اسم المورد بالعربي' },
        { name: 'name', label: 'الاسم بالإنجليزي', half: true },
        { name: 'phone', label: 'الهاتف', half: true, placeholder: '+971501234567' },
        { name: 'email', label: 'البريد الإلكتروني', type: 'email', half: true },
        { name: 'address', label: 'العنوان', placeholder: 'عنوان المورد' },
        { name: 'bankName', label: 'اسم البنك', half: true, placeholder: 'مثال: بنك الإمارات دبي الوطني' },
        { name: 'iban', label: 'IBAN', half: true, placeholder: 'AE07...' },
        { name: 'accountNumber', label: 'رقم الحساب', half: true },
        { name: 'accountHolder', label: 'اسم صاحب الحساب', half: true },
        {
          name: 'payoutTerms',
          label: 'شروط الدفع (بالأيام) — 0 = فوري',
          type: 'number',
          default: 7,
          hint: '0 = دفع فوري | 7 = بعد 7 أيام | 30 = بعد 30 يوم',
        },
        {
          name: 'commissionRate',
          label: 'نسبة عمولة نبتة (%)',
          type: 'number',
          half: true,
          step: '0.1',
          hint: 'اتركه فارغاً لاستخدام النسبة الافتراضية',
        },
        {
          name: 'preferredLanguage',
          label: 'لغة المراسلة',
          type: 'select',
          half: true,
          default: 'ar',
          options: [{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'الإنجليزية' }],
        },
        { name: 'notes', label: 'ملاحظات', type: 'textarea' },
      ]}
      toPayload={(v) => ({
        nameAr: v.nameAr.trim(),
        name: v.name.trim() || v.nameAr.trim(),
        phone: v.phone.trim(),
        email: v.email.trim(),
        address: v.address.trim(),
        bankName: v.bankName.trim(),
        iban: v.iban.trim(),
        accountNumber: v.accountNumber.trim(),
        accountHolder: v.accountHolder.trim(),
        payoutTerms: parseInt(v.payoutTerms, 10) || 0,
        preferredLanguage: v.preferredLanguage || 'ar',
        ...(v.commissionRate !== '' && v.commissionRate != null ? { commissionRate: Number(v.commissionRate) } : {}),
        notes: v.notes || null,
      })}
      viewModal={(v) => (
        <>
          <div className="form-row">
            <div><div className="order-info-label">الاسم العربي</div><div className="order-info-value">{v.nameAr || '-'}</div></div>
            <div><div className="order-info-label">الاسم الإنجليزي</div><div className="order-info-value">{v.name || '-'}</div></div>
            <div><div className="order-info-label">الهاتف</div><div className="order-info-value">{v.phone || '-'}</div></div>
            <div><div className="order-info-label">البريد</div><div className="order-info-value">{v.email || '-'}</div></div>
          </div>
          <hr className="form-divider" />
          <div className="form-section-title">
            <i className="fa-solid fa-credit-card" aria-hidden="true" /> البيانات البنكية
          </div>
          <div className="form-row">
            <div><div className="order-info-label">البنك</div><div className="order-info-value">{v.bankName || '-'}</div></div>
            <div>
              <div className="order-info-label">IBAN</div>
              <div className="order-info-value" style={{ direction: 'ltr', fontFamily: 'monospace' }}>{v.iban || '-'}</div>
            </div>
            <div><div className="order-info-label">رقم الحساب</div><div className="order-info-value">{v.accountNumber || '-'}</div></div>
            <div><div className="order-info-label">صاحب الحساب</div><div className="order-info-value">{v.accountHolder || '-'}</div></div>
          </div>
          <div className="mt-3" style={{ background: 'var(--orange-light)', padding: 10, borderRadius: 8, fontSize: 13 }}>
            ⏰ شروط الدفع: <strong>{v.payoutTerms === 0 ? 'دفع فوري' : `بعد ${v.payoutTerms} يوم`}</strong>
          </div>
        </>
      )}
    />
    </>
  );
}
