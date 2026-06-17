import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CrudPage from '../components/CrudPage.jsx';
import ExcelImportModal from '../components/ExcelImportModal.jsx';

// Account & finance can open this page read-only (عرض); only admin mutates.
// Note: the Vendor model has no `location` field, so unlike legacy we never
// send one (Prisma rejects unknown fields).
export default function VendorsPage() {
  const { t } = useTranslation();
  const [importing, setImporting] = useState(null); // { refresh } when open

  return (
    <>
      {importing && (
        <ExcelImportModal
          title={t('vendors.importTitle')}
          bulkEndpoint="/api/vendors/bulk"
          mapperName="mapExcelRowToVendor"
          templateName="downloadVendorsTemplate"
          itemNoun={t('vendors.itemNoun')}
          columnsHint={t('vendors.columnsHint')}
          onClose={() => setImporting(null)}
          onImported={importing.refresh}
        />
      )}
    <CrudPage
      toolbarExtra={({ refresh }) => (
        <button className="btn btn-secondary" onClick={() => setImporting({ refresh })}>
          <i className="fa-solid fa-file-excel" aria-hidden="true" /> {t('vendors.importExcel')}
        </button>
      )}
      entity="vendors"
      listKey="vendors"
      countLabel={(n) => t('vendors.count', { count: n })}
      addLabel={t('vendors.add')}
      modalTitles={{ add: t('vendors.addTitle'), edit: t('vendors.editTitle') }}
      messages={{
        added: t('vendors.added'),
        updated: t('vendors.updated'),
        deleted: t('vendors.deleted'),
        confirmTitle: t('vendors.confirmTitle'),
        confirmText: t('vendors.confirmText'),
      }}
      editRoles={['admin', 'account']}
      deleteRoles={['admin']}
      columns={[
        {
          header: t('vendors.vendorName'),
          render: (v) => (
            <>
              <strong>{v.nameAr || v.name}</strong>
              <br />
              <span className="text-muted">{v.name}</span>
            </>
          ),
        },
        { header: t('common.phone'), render: (v) => v.phone || '-' },
        { header: t('common.email'), render: (v) => v.email || '-' },
        { header: t('vendors.bank'), render: (v) => v.bankName || '-' },
        {
          header: 'IBAN',
          render: (v) => (
            <span style={{ direction: 'ltr', fontFamily: 'monospace', fontSize: 11 }}>{v.iban || '-'}</span>
          ),
        },
        {
          header: t('vendors.payoutTerms'),
          render: (v) =>
            v.payoutTerms === 0 ? (
              <span className="badge badge-confirmed">{t('vendors.immediate')}</span>
            ) : (
              <span className="badge badge-preparing">{t('vendors.afterDays', { count: v.payoutTerms })}</span>
            ),
        },
      ]}
      fields={[
        { name: 'nameAr', label: t('vendors.nameAr'), required: true, half: true, placeholder: t('vendors.nameArPlaceholder') },
        { name: 'name', label: t('vendors.nameEn'), half: true },
        { name: 'phone', label: t('common.phone'), half: true, placeholder: '+971501234567' },
        { name: 'email', label: t('common.email'), type: 'email', half: true },
        { name: 'address', label: t('common.address'), placeholder: t('vendors.addressPlaceholder') },
        { name: 'bankName', label: t('vendors.bankName'), half: true, placeholder: t('vendors.bankNamePlaceholder') },
        { name: 'iban', label: 'IBAN', half: true, placeholder: 'AE07...' },
        { name: 'accountNumber', label: t('vendors.accountNumber'), half: true },
        { name: 'accountHolder', label: t('vendors.accountHolder'), half: true },
        {
          name: 'payoutTerms',
          label: t('vendors.payoutTermsField'),
          type: 'number',
          default: 7,
          hint: t('vendors.payoutTermsHint'),
        },
        {
          name: 'commissionRate',
          label: t('vendors.commissionRate'),
          type: 'number',
          half: true,
          step: '0.1',
          hint: t('vendors.commissionRateHint'),
        },
        {
          name: 'preferredLanguage',
          label: t('common.messagingLang'),
          type: 'select',
          half: true,
          default: 'ar',
          options: [{ value: 'ar', label: t('lang.ar') }, { value: 'en', label: t('lang.en') }],
        },
        { name: 'notes', label: t('common.notes'), type: 'textarea' },
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
            <div><div className="order-info-label">{t('vendors.nameAr')}</div><div className="order-info-value">{v.nameAr || '-'}</div></div>
            <div><div className="order-info-label">{t('vendors.nameEn')}</div><div className="order-info-value">{v.name || '-'}</div></div>
            <div><div className="order-info-label">{t('common.phone')}</div><div className="order-info-value">{v.phone || '-'}</div></div>
            <div><div className="order-info-label">{t('common.email')}</div><div className="order-info-value">{v.email || '-'}</div></div>
          </div>
          <hr className="form-divider" />
          <div className="form-section-title">
            <i className="fa-solid fa-credit-card" aria-hidden="true" /> {t('vendors.bankDetails')}
          </div>
          <div className="form-row">
            <div><div className="order-info-label">{t('vendors.bank')}</div><div className="order-info-value">{v.bankName || '-'}</div></div>
            <div>
              <div className="order-info-label">IBAN</div>
              <div className="order-info-value" style={{ direction: 'ltr', fontFamily: 'monospace' }}>{v.iban || '-'}</div>
            </div>
            <div><div className="order-info-label">{t('vendors.accountNumber')}</div><div className="order-info-value">{v.accountNumber || '-'}</div></div>
            <div><div className="order-info-label">{t('vendors.accountHolderShort')}</div><div className="order-info-value">{v.accountHolder || '-'}</div></div>
          </div>
          <div className="mt-3" style={{ background: 'var(--orange-light)', padding: 10, borderRadius: 8, fontSize: 13 }}>
            ⏰ {t('vendors.payoutTerms')}: <strong>{v.payoutTerms === 0 ? t('vendors.immediatePayment') : t('vendors.afterDays', { count: v.payoutTerms })}</strong>
          </div>
        </>
      )}
    />
    </>
  );
}
