import { useState } from 'react';
import CrudPage from '../components/CrudPage.jsx';
import ExcelImportModal from '../components/ExcelImportModal.jsx';
import { formatCurrency } from '../utils/format.js';

// Backend guards: create/update/delete are admin-only (legacy UI also allowed
// sales, but the API would reject with 403 — backend rules win).
export default function ProductsPage() {
  const [importing, setImporting] = useState(null); // { refresh } when open

  return (
    <>
      {importing && (
        <ExcelImportModal
          title="استيراد المنتجات من Excel"
          bulkEndpoint="/api/products/bulk"
          mapperName="mapExcelRowToProduct"
          templateName="downloadProductsTemplate"
          needsVendors
          itemNoun="منتج"
          columnsHint="الأعمدة المدعومة: اسم المنتج، الفئة، السعر، الوحدة، المخزون، المورد (يجب أن يطابق اسم مورد موجود)"
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
      entity="products"
      listKey="products"
      countLabel={(n) => `${n} منتج`}
      addLabel="+ إضافة منتج"
      modalTitles={{ add: 'إضافة منتج جديد', edit: 'تعديل المنتج' }}
      messages={{
        added: 'تم إضافة المنتج',
        updated: 'تم تعديل المنتج',
        deleted: 'تم حذف المنتج',
        confirmTitle: 'حذف المنتج',
        confirmText: 'هل تريد حذف هذا المنتج؟',
      }}
      editRoles={['admin']}
      deleteRoles={['admin']}
      lookups={{ vendors: 'vendors' }}
      columns={[
        {
          header: 'اسم المنتج',
          render: (p) => (
            <>
              <strong>{p.nameAr || p.name}</strong>
              <br />
              <span className="text-muted">{p.name}</span>
            </>
          ),
        },
        { header: 'الفئة', render: (p) => <span className="badge badge-active">{p.category}</span> },
        { header: 'السعر', render: (p) => formatCurrency(p.price) },
        { header: 'الوحدة', render: (p) => p.unit },
        {
          header: 'المخزون',
          render: (p) => <span className={`${p.stock > 20 ? 'text-green' : 'text-red'} fw-bold`}>{p.stock}</span>,
        },
        { header: 'المورد', render: (p) => p.vendor?.nameAr || p.vendor?.name || '-' },
      ]}
      fields={[
        { name: 'nameAr', label: 'الاسم بالعربي', required: true, half: true, placeholder: 'اسم المنتج بالعربي' },
        { name: 'name', label: 'الاسم بالإنجليزي', half: true, placeholder: 'Product name in English' },
        { name: 'category', label: 'الفئة', required: true, half: true, placeholder: 'مثال: أسمدة، بذور، معدات' },
        { name: 'unit', label: 'الوحدة', required: true, half: true, placeholder: 'مثال: كيس 25 كجم، حبة، لتر' },
        { name: 'price', label: 'السعر (د.إ)', type: 'number', step: '0.01', required: true, half: true },
        { name: 'stock', label: 'المخزون', type: 'number', default: 0, half: true },
        {
          name: 'vendorId',
          label: 'المورد',
          type: 'select',
          required: true, // vendorId is a required FK in the Prisma schema
          lookup: 'vendors',
          optionLabel: (v) => v.nameAr || v.name,
          placeholder: '-- اختر مورد --',
        },
        { name: 'description', label: 'الوصف', type: 'textarea' },
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
