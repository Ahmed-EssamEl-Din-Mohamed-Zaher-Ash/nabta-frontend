import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { apiErrorMessage } from '../api/client.js';
import { useToast } from '../components/ToastHost.jsx';
import { formatCurrency } from '../utils/format.js';
import Modal from '../components/Modal.jsx';

const TABS = [
  { key: 'overview', labelKey: 'finance.tabs.overview' },
  { key: 'dues', labelKey: 'finance.tabs.dues' },
  { key: 'commissions', labelKey: 'finance.tabs.commissions' },
];

function Kpi({ label, value, accent }) {
  return (
    <div className="card" style={{ flex: '1 1 180px', minWidth: 180 }}>
      <div className="card-body">
        <div className="text-muted" style={{ fontSize: 12 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: accent || 'var(--gray-800)', marginTop: 4 }}>
          {formatCurrency(value)}
        </div>
      </div>
    </div>
  );
}

export default function FinancePage() {
  const { t } = useTranslation();
  const showToast = useToast();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [dues, setDues] = useState(null);
  const [commissions, setCommissions] = useState(null);
  const [payoutFor, setPayoutFor] = useState(null); // vendor row being paid
  const [payout, setPayout] = useState({ amount: '', method: 'bank_transfer', reference: '', notes: '' });

  useEffect(() => {
    async function loadTab() {
      try {
        if (tab === 'overview' && !overview) setOverview((await api.get('/api/finance/overview')).data);
        if (tab === 'dues' && !dues) setDues((await api.get('/api/finance/vendor-dues')).data.vendors);
        if (tab === 'commissions' && !commissions) setCommissions((await api.get('/api/finance/commissions')).data);
      } catch (err) {
        showToast(apiErrorMessage(err), 'error');
      }
    }
    loadTab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function reloadDues() {
    try {
      const { data } = await api.get('/api/finance/vendor-dues');
      setDues(data.vendors);
      setOverview(null); // force overview refresh next time
    } catch { /* ignore */ }
  }

  function openPayout(v) {
    setPayoutFor(v);
    setPayout({ amount: v.balance > 0 ? v.balance : '', method: 'bank_transfer', reference: '', notes: '' });
  }

  async function savePayout() {
    if (!payout.amount || Number(payout.amount) <= 0) return showToast(t('finance.payout.invalidAmount'), 'error');
    try {
      await api.post('/api/finance/vendor-payouts', { vendorId: payoutFor.id, ...payout, amount: Number(payout.amount) });
      showToast(t('finance.payout.saved'), 'success');
      setPayoutFor(null);
      reloadDues();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  async function exportExcel() {
    try {
      const [ov, dv, cm] = await Promise.all([
        overview ? { data: overview } : api.get('/api/finance/overview'),
        dues ? { data: { vendors: dues } } : api.get('/api/finance/vendor-dues'),
        commissions ? { data: commissions } : api.get('/api/finance/commissions'),
      ]);
      const { exportFinanceModuleExcel } = await import('../utils/excel.js');
      exportFinanceModuleExcel({ overview: ov.data, dues: dv.data.vendors, commissions: cm.data });
      showToast(t('finance.exportSuccess'), 'success');
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  return (
    <>
      <div className="page-toolbar">
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('nav.finance')}</h3>
        <div className="toolbar-right">
          <button className="btn btn-secondary" onClick={exportExcel}>
            <i className="fa-solid fa-file-excel" aria-hidden="true" /> {t('finance.exportExcel')}
          </button>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <i className="fa-solid fa-print" aria-hidden="true" /> {t('finance.printPdf')}
          </button>
        </div>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map((tab_) => (
          <button
            key={tab_.key}
            className={`btn btn-sm ${tab === tab_.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(tab_.key)}
          >
            {t(tab_.labelKey)}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        !overview ? <div className="loading"><div className="spinner" /></div> : (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <Kpi label={t('finance.kpi.totalSales')} value={overview.summary.totalSales} accent="var(--green-700)" />
              <Kpi label={t('finance.kpi.totalCollected')} value={overview.summary.totalCollected} accent="var(--green-700)" />
              <Kpi label={t('finance.kpi.totalPendingCollection')} value={overview.summary.totalPendingCollection} accent="var(--orange)" />
              <Kpi label={t('finance.kpi.totalCommission')} value={overview.summary.totalCommission} accent="var(--blue-600, #2563eb)" />
              <Kpi label={t('finance.kpi.totalVendorNetPayable')} value={overview.summary.totalVendorNetPayable} />
              <Kpi label={t('finance.kpi.totalVendorBalance')} value={overview.summary.totalVendorBalance} accent="var(--orange)" />
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div className="card" style={{ flex: '1 1 320px' }}>
                <div className="card-header"><h3>{t('finance.byMethod')}</h3></div>
                <div className="card-body">
                  {Object.entries(overview.byMethod).map(([m, v]) => (
                    <div key={m} className="total-row"><span>{t(`payments.method.${m}`, m)} ({v.count})</span><span>{formatCurrency(v.total)}</span></div>
                  ))}
                </div>
              </div>
              <div className="card" style={{ flex: '1 1 320px' }}>
                <div className="card-header"><h3>{t('finance.byStatus')}</h3></div>
                <div className="card-body">
                  {Object.entries(overview.byStatus).map(([s, total]) => (
                    <div key={s} className="total-row"><span>{t(`payments.status.${s}`, s)}</span><span>{formatCurrency(total)}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )
      )}

      {/* VENDOR DUES */}
      {tab === 'dues' && (
        !dues ? <div className="loading"><div className="spinner" /></div> : (
          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>{t('common.vendor')}</th><th>{t('finance.col.gross')}</th><th>{t('finance.col.commission')}</th><th>{t('finance.col.netPayable')}</th>
                    <th>{t('finance.col.paid')}</th><th>{t('finance.col.balance')}</th><th>{t('finance.col.payoutTerms')}</th><th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dues.length === 0 ? (
                    <tr><td colSpan={8}><div className="empty-state" style={{ padding: 24 }}><h3>{t('common.noData')}</h3></div></td></tr>
                  ) : dues.map((v) => (
                    <tr key={v.id}>
                      <td>{v.nameAr || v.name}</td>
                      <td>{formatCurrency(v.gross)}</td>
                      <td>{formatCurrency(v.commission)} <span className="text-muted">({v.commissionRate}%)</span></td>
                      <td>{formatCurrency(v.netPayable)}</td>
                      <td>{formatCurrency(v.paid)}</td>
                      <td style={{ fontWeight: 700, color: v.balance > 0 ? 'var(--orange)' : 'var(--green-700)' }}>{formatCurrency(v.balance)}</td>
                      <td>{v.payoutTerms === 0 ? t('finance.payoutTerms.immediate') : t('finance.payoutTerms.days', { count: v.payoutTerms })}</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => openPayout(v)}>{t('finance.payout.record')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* COMMISSIONS */}
      {tab === 'commissions' && (
        !commissions ? <div className="loading"><div className="spinner" /></div> : (
          <div className="card">
            <div className="card-body" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div><span className="text-muted">{t('finance.totalGross')}: </span><strong>{formatCurrency(commissions.totals.gross)}</strong></div>
              <div><span className="text-muted">{t('finance.totalCommissions')}: </span><strong style={{ color: 'var(--green-700)' }}>{formatCurrency(commissions.totals.commission)}</strong></div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>{t('finance.col.orderNumber')}</th><th>{t('common.date')}</th><th>{t('common.customer')}</th><th>{t('finance.col.goodsValue')}</th><th>{t('finance.col.nabtaCommission')}</th></tr>
                </thead>
                <tbody>
                  {commissions.orders.length === 0 ? (
                    <tr><td colSpan={5}><div className="empty-state" style={{ padding: 24 }}><h3>{t('finance.noCompletedOrders')}</h3></div></td></tr>
                  ) : commissions.orders.map((o) => (
                    <tr key={o.orderId}>
                      <td><strong>{o.orderNumber}</strong></td>
                      <td>{o.date}</td>
                      <td>{o.customer}</td>
                      <td>{formatCurrency(o.gross)}</td>
                      <td style={{ color: 'var(--green-700)' }}>{formatCurrency(o.commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {payoutFor && (
        <Modal
          title={t('finance.payout.modalTitle', { name: payoutFor.nameAr || payoutFor.name })}
          onClose={() => setPayoutFor(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setPayoutFor(null)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={savePayout}>{t('common.save')}</button>
            </>
          }
        >
          <div className="form-group">
            <label>{t('finance.payout.amountLabel')} <span className="required-star">*</span></label>
            <input type="number" min="0" value={payout.amount} onChange={(e) => setPayout({ ...payout, amount: e.target.value })} />
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{t('finance.payout.balanceDue')}: {formatCurrency(payoutFor.balance)}</div>
          </div>
          <div className="form-group">
            <label>{t('finance.payout.method')}</label>
            <select value={payout.method} onChange={(e) => setPayout({ ...payout, method: e.target.value })}>
              <option value="bank_transfer">{t('finance.payout.bankTransfer')}</option>
              <option value="cash">{t('finance.payout.cash')}</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('finance.payout.reference')}</label>
            <input type="text" value={payout.reference} onChange={(e) => setPayout({ ...payout, reference: e.target.value })} />
          </div>
          <div className="form-group">
            <label>{t('common.notes')}</label>
            <textarea value={payout.notes} onChange={(e) => setPayout({ ...payout, notes: e.target.value })} />
          </div>
        </Modal>
      )}
    </>
  );
}
