import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client.js';
import { useToast } from '../components/ToastHost.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { STATUS_LABELS } from '../constants/permissions.js';
import { formatCurrency, orderTotals } from '../utils/format.js';

// Admin-only — React port of legacy renderCycleAudit()
const PIPELINE_COLORS = {
  new: '#6366F1', confirmed: '#0EA5E9', preparing: '#F59E0B',
  ready: '#8B5CF6', out: '#F97316', delivered: '#22C55E',
  paid: '#14B8A6', failed: '#EF4444',
};
const PIPELINE_STAGES = ['new', 'confirmed', 'preparing', 'ready', 'out', 'delivered', 'paid'];

const fmtDate = (d) => (d ? String(d).slice(0, 10) : '-');

function StageDots({ status }) {
  const curIdx = PIPELINE_STAGES.indexOf(status);
  const isFailed = status === 'failed';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {PIPELINE_STAGES.map((s, i) => {
        const base = {
          width: 22, height: 22, borderRadius: '50%', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
        };
        let style, glyph;
        if (isFailed && i <= 4) {
          style = { ...base, background: '#EF4444', color: '#fff' };
          glyph = '✕';
        } else if (i < curIdx) {
          style = { ...base, background: PIPELINE_COLORS[s], color: '#fff' };
          glyph = '✓';
        } else if (i === curIdx) {
          style = { ...base, background: PIPELINE_COLORS[s], color: '#fff', boxShadow: `0 0 0 3px ${PIPELINE_COLORS[s]}33` };
          glyph = '●';
        } else {
          style = { ...base, background: 'var(--gray-200)', color: 'var(--gray-400)' };
          glyph = '○';
        }
        return (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <span title={STATUS_LABELS[s]} style={style}>{glyph}</span>
            {i < PIPELINE_STAGES.length - 1 && (
              <span style={{ color: 'var(--gray-300)', fontSize: 9 }}>→</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export default function CycleAuditPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    api
      .get('/api/orders', { params: { limit: 1000 } })
      .then(({ data }) => setOrders(data.orders))
      .catch((err) => showToast(apiErrorMessage(err), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runExport(kind) {
    try {
      const excel = await import('../utils/excel.js');
      if (kind === 'sales') {
        excel.exportSalesExcel(orders);
      } else if (kind === 'account') {
        const { data } = await api.get('/api/vendors');
        excel.exportAccountExcel(orders, data.vendors);
      } else if (kind === 'ops') {
        const { data } = await api.get('/api/drivers');
        excel.exportOpsExcel(orders, data.drivers);
      } else if (kind === 'finance') {
        const { data } = await api.get('/api/vendors');
        excel.exportFinanceExcel(orders, data.vendors);
      } else {
        const [v, c, d] = await Promise.all([
          api.get('/api/vendors'), api.get('/api/customers'), api.get('/api/drivers'),
        ]);
        excel.exportMasterExcel(orders, v.data.vendors, c.data.customers, d.data.drivers);
      }
      showToast('تم تصدير الملف بنجاح', 'success');
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  if (!orders) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  const counts = {};
  [...PIPELINE_STAGES, 'failed'].forEach((s) => {
    counts[s] = orders.filter((o) => o.status === s).length;
  });
  const total = orders.length;
  const journey = [...orders].slice(0, 50);

  const exportButtons = [
    { kind: 'sales', icon: 'fa-briefcase', label: 'تصدير المبيعات', chip: 'شيتان', chipBg: 'var(--blue-light)', chipColor: 'var(--blue)' },
    { kind: 'account', icon: 'fa-box', label: 'تصدير الحسابات', chip: 'شيتان', chipBg: 'var(--yellow-light)', chipColor: '#92400E' },
    { kind: 'ops', icon: 'fa-truck', label: 'تصدير التوصيل', chip: 'شيتان', chipBg: 'var(--orange-light)', chipColor: '#9A3412' },
    { kind: 'finance', icon: 'fa-coins', label: 'تصدير المحاسبة', chip: '3 شيتات', chipBg: 'var(--green-100)', chipColor: 'var(--green-700)' },
  ];

  return (
    <>
      {/* Pipeline overview */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3><i className="fa-solid fa-rotate" aria-hidden="true" /> خط أنابيب الطلبات — Pipeline View</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/orders')}>← الطلبات</button>
            <button className="btn btn-primary btn-sm" onClick={() => runExport('master')}>
              <i className="fa-solid fa-download" aria-hidden="true" /> تصدير الملف الشامل
            </button>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, overflowX: 'auto', paddingBottom: 8 }}>
            {PIPELINE_STAGES.map((s, i) => {
              const c = counts[s];
              const pct = total > 0 ? Math.round((c / total) * 100) : 0;
              const color = PIPELINE_COLORS[s];
              return (
                <span key={s} style={{ display: 'contents' }}>
                  <div style={{ flex: 1, minWidth: 100, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color }}>{c}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-600)', fontWeight: 600, margin: '4px 0' }}>
                      {STATUS_LABELS[s]}
                    </div>
                    <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 3, overflow: 'hidden', margin: '0 4px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .6s ease' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 3 }}>{pct}%</div>
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div style={{ alignSelf: 'flex-end', paddingBottom: 18, color: 'var(--gray-300)', fontSize: 18 }}>→</div>
                  )}
                </span>
              );
            })}
          </div>
          {counts.failed > 0 ? (
            <div style={{ marginTop: 12, background: 'var(--red-light)', color: 'var(--red)', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {counts.failed} طلب بحالة فشل التسليم — يتطلب مراجعة
            </div>
          ) : (
            <div style={{ marginTop: 12, background: 'var(--green-100)', color: 'var(--green-700)', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              <i className="fa-solid fa-check" aria-hidden="true" /> لا توجد طلبات فاشلة
            </div>
          )}
        </div>
      </div>

      {/* Stage breakdown cards */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {PIPELINE_STAGES.map((s) => {
          const stOrders = orders.filter((o) => o.status === s);
          const val = stOrders.reduce((sum, o) => sum + orderTotals(o).total, 0);
          return (
            <div className="stat-card" key={s} style={{ borderRight: `4px solid ${PIPELINE_COLORS[s]}` }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: PIPELINE_COLORS[s] }}>{counts[s]}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{STATUS_LABELS[s]}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginTop: 4 }}>
                  {formatCurrency(val)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Export by stage */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3><i className="fa-solid fa-file-import" aria-hidden="true" /> تصدير حسب المرحلة</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {exportButtons.map((b) => (
              <button key={b.kind} className="btn btn-secondary" onClick={() => runExport(b.kind)}>
                <i className={`fa-solid ${b.icon}`} aria-hidden="true" /> {b.label}
                <span style={{ background: b.chipBg, color: b.chipColor, padding: '2px 8px', borderRadius: 10, fontSize: 11, marginRight: 4 }}>
                  {b.chip}
                </span>
              </button>
            ))}
            <button className="btn btn-primary" onClick={() => runExport('master')}>
              <i className="fa-solid fa-download" aria-hidden="true" /> تصدير الملف الشامل
              <span style={{ background: 'rgba(255,255,255,.25)', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 11, marginRight: 4 }}>
                6 شيتات
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Order journey table */}
      <div className="card">
        <div className="card-header"><h3>رحلة الطلبات (آخر 50)</h3></div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>رقم الطلب</th><th>التاريخ</th><th>العميل</th><th>المورد</th><th>السائق</th>
                <th>الحالة</th><th>الرحلة</th><th>الإجمالي</th><th>تاريخ التأكيد</th><th>تاريخ التسليم</th>
              </tr>
            </thead>
            <tbody>
              {journey.map((o) => (
                <tr key={o.id}>
                  <td><strong style={{ color: 'var(--green-700)' }}>{o.orderNumber}</strong></td>
                  <td style={{ fontSize: 12 }}>{fmtDate(o.date)}</td>
                  <td style={{ fontSize: 12 }}>{o.customer?.name || '-'}</td>
                  <td style={{ fontSize: 12 }}>{o.vendor?.nameAr || o.vendor?.name || '-'}</td>
                  <td style={{ fontSize: 12 }}>{o.driver?.name || '-'}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td><StageDots status={o.status} /></td>
                  <td style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-700)' }}>
                    {formatCurrency(orderTotals(o).total)}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>{fmtDate(o.confirmedAt)}</td>
                  <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>{fmtDate(o.deliveredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
