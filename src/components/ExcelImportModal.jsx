import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../api/client.js';
import Modal from './Modal.jsx';
import { useToast } from './ToastHost.jsx';

/**
 * Products Excel import — React port of the legacy excel-modal.
 * Flexible column matching (Arabic/English headers), 5-row preview,
 * then POSTs each row to /api/products. Rows without a resolvable vendor
 * are skipped (vendorId is required by the schema) and reported.
 */
export default function ExcelImportModal({ onClose, onImported }) {
  const showToast = useToast();
  const [vendors, setVendors] = useState([]);
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api
      .get('/api/vendors')
      .then(({ data }) => setVendors(data.vendors))
      .catch((err) => showToast(apiErrorMessage(err), 'error'));
  }, [showToast]);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { readWorkbookRows } = await import('../utils/excel.js');
      const buffer = await file.arrayBuffer();
      setRows(readWorkbookRows(buffer));
    } catch {
      showToast('خطأ في قراءة الملف', 'error');
      setRows([]);
    }
  }

  async function downloadTemplate() {
    const { downloadProductsTemplate } = await import('../utils/excel.js');
    downloadProductsTemplate();
  }

  async function doImport() {
    setImporting(true);
    const { mapExcelRowToProduct } = await import('../utils/excel.js');
    let added = 0;
    let skipped = 0;
    for (const row of rows) {
      const product = mapExcelRowToProduct(row, vendors);
      if (!product || !product.vendorId) {
        skipped++;
        continue;
      }
      try {
        await api.post('/api/products', product);
        added++;
      } catch (err) {
        skipped++;
        console.warn('Import row failed:', apiErrorMessage(err));
      }
    }
    setImporting(false);
    showToast(
      skipped > 0 ? `تم استيراد ${added} منتج (تم تخطي ${skipped} — تحقق من عمود المورد)` : `تم استيراد ${added} منتج`,
      skipped > 0 ? 'warning' : 'success'
    );
    onImported();
    onClose();
  }

  const previewCols = rows.length ? Object.keys(rows[0]) : [];

  return (
    <Modal
      title="استيراد المنتجات من Excel"
      size="xl"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>إلغاء</button>
          <button className="btn btn-primary" onClick={doImport} disabled={!rows.length || importing}>
            {importing ? 'جارٍ الاستيراد…' : `استيراد ${rows.length} صف`}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
        <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
          <i className="fa-solid fa-download" aria-hidden="true" /> تحميل القالب
        </button>
      </div>
      <p className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
        الأعمدة المدعومة: اسم المنتج، الفئة، السعر، الوحدة، المخزون، المورد (يجب أن يطابق اسم مورد موجود)
      </p>

      {rows.length > 0 && (
        <>
          <div className="table-wrapper">
            <table style={{ fontSize: 12 }}>
              <thead>
                <tr>{previewCols.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {previewCols.map((c) => <td key={c}>{String(row[c] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted mt-2">إجمالي: {rows.length} صف (يُعرض أول 5)</p>
        </>
      )}
    </Modal>
  );
}
