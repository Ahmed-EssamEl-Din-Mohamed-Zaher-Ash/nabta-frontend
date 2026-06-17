import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../api/client.js';
import Modal from './Modal.jsx';
import { useToast } from './ToastHost.jsx';

/**
 * Generic Excel bulk-import modal (used by Products & Vendors).
 *
 * Reads a workbook into JSON rows, previews the first 5, then maps every row and
 * POSTs the whole array in ONE request to `bulkEndpoint`. The backend validates,
 * de-duplicates and inserts via createMany, returning { created, skipped, errors }.
 *
 * The mapper/template are passed by NAME and resolved with a dynamic import of
 * utils/excel.js, so the heavy `xlsx` dependency stays out of the main bundle.
 *
 * Props:
 * - title         modal title
 * - bulkEndpoint  e.g. '/api/products/bulk'
 * - mapperName    export in utils/excel.js, e.g. 'mapExcelRowToProduct' — (row, vendors) => obj | null
 * - templateName  export in utils/excel.js, e.g. 'downloadProductsTemplate'
 * - needsVendors  when true, fetches /api/vendors so the mapper can resolve a
 *                 vendor name → vendorId (products only)
 * - columnsHint   short help text listing supported columns
 * - itemNoun      Arabic noun for the toast, e.g. 'منتج' / 'مورد'
 * - onClose / onImported
 */
export default function ExcelImportModal({
  title,
  bulkEndpoint,
  mapperName,
  templateName,
  needsVendors = false,
  columnsHint,
  itemNoun = 'صف',
  onClose,
  onImported,
}) {
  const showToast = useToast();
  const [vendors, setVendors] = useState([]);
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!needsVendors) return;
    api
      .get('/api/vendors')
      .then(({ data }) => setVendors(data.vendors))
      .catch((err) => showToast(apiErrorMessage(err), 'error'));
  }, [needsVendors, showToast]);

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
    const mod = await import('../utils/excel.js');
    mod[templateName]();
  }

  async function doImport() {
    setImporting(true);
    try {
      const mod = await import('../utils/excel.js');
      const mapRow = mod[mapperName];
      // Vendor mapper ignores the 2nd arg; product mapper resolves it to vendorId.
      const mapped = rows.map((r) => mapRow(r, vendors)).filter(Boolean);
      const localSkipped = rows.length - mapped.length;

      if (mapped.length === 0) {
        showToast('لا توجد صفوف صالحة للاستيراد', 'warning');
        return;
      }

      // Single POST: the whole array goes to the backend in one request.
      const { data } = await api.post(bulkEndpoint, { rows: mapped });
      const created = data.created ?? 0;
      const skipped = (data.skipped ?? 0) + localSkipped;
      showToast(
        skipped > 0
          ? `تم استيراد ${created} ${itemNoun} (تم تخطي ${skipped} — تحقق من البيانات أو التكرار)`
          : `تم استيراد ${created} ${itemNoun}`,
        skipped > 0 ? 'warning' : 'success'
      );
      onImported();
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setImporting(false);
    }
  }

  const previewCols = rows.length ? Object.keys(rows[0]) : [];

  return (
    <Modal
      title={title}
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
      {columnsHint && (
        <p className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>{columnsHint}</p>
      )}

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
