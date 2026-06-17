import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CrudPage from '../components/CrudPage.jsx';
import ExcelImportModal from '../components/ExcelImportModal.jsx';
import { formatCurrency } from '../utils/format.js';

// Backend guards: create/update/delete are admin-only (legacy UI also allowed
// sales, but the API would reject with 403 — backend rules win).
export default function ProductsPage() {
  const { t } = useTranslation();
  const [importing, setImporting] = useState(null); // { refresh } when open

  return (
    <>
      {importing && (
        <ExcelImportModal
          title={t('products.importTitle')}
          bulkEndpoint="/api/products/bulk"
          mapperName="mapExcelRowToProduct"
          templateName="downloadProductsTemplate"
          needsVendors
          itemNoun={t('products.itemNoun')}
          columnsHint={t('products.columnsHint')}
          onClose={() => setImporting(null)}
          onImported={importing.refresh}
        />
      )}
    <CrudPage
      toolbarExtra={({ refresh }) => (
        <button className="btn btn-secondary" onClick={() => setImporting({ refresh })}>
          <i className="fa-solid fa-file-excel" aria-hidden="true" /> {t('products.importExcel')}
        </button>
      )}
      entity="products"
      listKey="products"
      countLabel={(n) => t('products.count', { count: n })}
      addLabel={t('products.add')}
      modalTitles={{ add: t('products.addTitle'), edit: t('products.editTitle') }}
      messages={{
        added: t('products.added'),
        updated: t('products.updated'),
        deleted: t('products.deleted'),
        confirmTitle: t('products.confirmTitle'),
        confirmText: t('products.confirmText'),
      }}
      editRoles={['admin']}
      deleteRoles={['admin']}
      lookups={{ vendors: 'vendors' }}
      columns={[
        {
          header: t('products.name'),
          render: (p) => (
            <>
              <strong>{p.nameAr || p.name}</strong>
              <br />
              <span className="text-muted">{p.name}</span>
            </>
          ),
        },
        { header: t('products.category'), render: (p) => <span className="badge badge-active">{p.category}</span> },
        { header: t('common.price'), render: (p) => formatCurrency(p.price) },
        { header: t('products.unit'), render: (p) => p.unit },
        {
          header: t('products.stock'),
          render: (p) => <span className={`${p.stock > 20 ? 'text-green' : 'text-red'} fw-bold`}>{p.stock}</span>,
        },
        { header: t('common.vendor'), render: (p) => p.vendor?.nameAr || p.vendor?.name || '-' },
      ]}
      fields={[
        { name: 'nameAr', label: t('products.nameAr'), required: true, half: true, placeholder: t('products.nameArPlaceholder') },
        { name: 'name', label: t('products.nameEn'), half: true, placeholder: 'Product name in English' },
        { name: 'category', label: t('products.category'), required: true, half: true, placeholder: t('products.categoryPlaceholder') },
        { name: 'unit', label: t('products.unit'), required: true, half: true, placeholder: t('products.unitPlaceholder') },
        { name: 'price', label: t('products.priceLabel'), type: 'number', step: '0.01', required: true, half: true },
        { name: 'stock', label: t('products.stock'), type: 'number', default: 0, half: true },
        {
          name: 'vendorId',
          label: t('common.vendor'),
          type: 'select',
          required: true, // vendorId is a required FK in the Prisma schema
          lookup: 'vendors',
          optionLabel: (v) => v.nameAr || v.name,
          placeholder: t('products.vendorPlaceholder'),
        },
        { name: 'description', label: t('products.description'), type: 'textarea' },
      ]}
      toPayload={(v) => ({
        nameAr: v.nameAr.trim(),
        name: v.name.trim() || v.nameAr.trim(),
        category: v.category.trim(),
        unit: v.unit.trim(),
        price: parseFloat(v.price) || 0,
        stock: parseInt(v.stock, 10) || 0,
        vendorId: v.vendorId,
        description: v.description || null,
      })}
    />
    </>
  );
}
