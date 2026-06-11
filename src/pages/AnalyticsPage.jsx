import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement, BarElement, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import api, { apiErrorMessage } from '../api/client.js';
import { useToast } from '../components/ToastHost.jsx';
import { STATUS_LABELS } from '../constants/permissions.js';
import { formatCurrency } from '../utils/format.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

// Same palette/order as legacy buildAnalyticsCharts
const STATUS_KEYS = Object.keys(STATUS_LABELS);
const STATUS_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#8b5cf6', '#3b82f6', '#22c55e', '#ef4444', '#6b7280'];

export default function AnalyticsPage() {
  const showToast = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get('/api/reports/analytics')
      .then((res) => setData(res.data))
      .catch((err) => showToast(apiErrorMessage(err), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function exportExcel() {
    try {
      const { exportAnalyticsExcel } = await import('../utils/excel.js');
      const [o, v, p] = await Promise.all([
        api.get('/api/orders', { params: { limit: 1000 } }),
        api.get('/api/vendors'),
        api.get('/api/products'),
      ]);
      exportAnalyticsExcel(o.data.orders, v.data.vendors, p.data.products);
      showToast('تم تصدير التقرير بنجاح', 'success');
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  if (!data) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  const { stats, statusCounts, vendorSummary, topProducts, monthlyOrders } = data;

  const statCards = [
    { icon: 'fa-clipboard-list', bg: 'var(--blue-light)', value: stats.totalOrders, label: 'إجمالي الأوردرات' },
    { icon: 'fa-check', bg: 'var(--green-100)', value: stats.deliveredOrders, label: 'أوردرات مسلّمة' },
    { icon: 'fa-coins', bg: 'var(--green-100)', value: formatCurrency(stats.totalRevenue), label: 'إجمالي الإيرادات' },
    { icon: 'fa-hourglass-half', bg: 'var(--orange-light)', value: formatCurrency(stats.pendingPayment), label: 'مستحق للموردين' },
    { icon: 'fa-chart-column', bg: 'var(--purple-light)', value: formatCurrency(stats.avgOrderValue), label: 'متوسط قيمة الأوردر' },
    { icon: 'fa-industry', bg: 'var(--yellow-light)', value: stats.vendorsCount, label: 'عدد الموردين' },
  ];

  const presentStatuses = STATUS_KEYS.filter((k) => (statusCounts[k] || 0) > 0);
  const fontFamily = { family: 'Tajawal' };
  const revVendors = vendorSummary.filter((v) => v.revenue > 0);

  return (
    <>
      <div className="stats-grid">
        {statCards.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon" style={{ background: s.bg }}>
              <span style={{ fontSize: 22 }}><i className={`fa-solid ${s.icon}`} aria-hidden="true" /></span>
            </div>
            <div className="stat-info"><h3>{s.value}</h3><p>{s.label}</p></div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h4>توزيع الأوردرات حسب الحالة</h4>
          <Doughnut
            data={{
              labels: presentStatuses.map((k) => STATUS_LABELS[k]),
              datasets: [{
                data: presentStatuses.map((k) => statusCounts[k]),
                backgroundColor: presentStatuses.map((k) => STATUS_COLORS[STATUS_KEYS.indexOf(k)]),
                borderWidth: 2,
                borderColor: '#fff',
              }],
            }}
            options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { ...fontFamily, size: 11 } } } } }}
          />
        </div>

        <div className="chart-card">
          <h4>الإيراد حسب المورد</h4>
          <Bar
            data={{
              labels: revVendors.map((v) => v.nameAr || v.name),
              datasets: [{ label: 'الإيراد (د.إ)', data: revVendors.map((v) => v.revenue), backgroundColor: '#1E7C3F', borderRadius: 6 }],
            }}
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true }, x: { ticks: { font: fontFamily } } },
            }}
          />
        </div>

        <div className="chart-card">
          <h4>أكثر المنتجات طلباً</h4>
          <Bar
            data={{
              labels: topProducts.map((p) => p.name),
              datasets: [{ label: 'الكمية المطلوبة', data: topProducts.map((p) => p.qty), backgroundColor: '#25964C', borderRadius: 6 }],
            }}
            options={{
              indexAxis: 'y',
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { x: { beginAtZero: true } },
            }}
          />
        </div>

        <div className="chart-card">
          <h4>الأوردرات خلال الأشهر الأخيرة</h4>
          <Line
            data={{
              labels: monthlyOrders.map((m) => m.month),
              datasets: [{
                label: 'عدد الأوردرات',
                data: monthlyOrders.map((m) => m.count),
                borderColor: '#1E7C3F',
                backgroundColor: 'rgba(30,124,63,.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#1E7C3F',
                pointRadius: 4,
              }],
            }}
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            }}
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h3>ملخص الموردين</h3>
          <button className="btn btn-secondary btn-sm" onClick={exportExcel}>
            <i className="fa-solid fa-download" aria-hidden="true" /> تصدير Excel
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>المورد</th><th>عدد الأوردرات</th><th>الإيراد الكلي</th><th>المستحق</th><th>شروط الدفع</th></tr>
            </thead>
            <tbody>
              {vendorSummary.map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.nameAr || v.name}</strong></td>
                  <td>{v.ordersCount}</td>
                  <td className="text-green fw-bold">{formatCurrency(v.revenue)}</td>
                  <td className={v.pending > 0 ? 'text-red fw-bold' : 'text-muted'}>{formatCurrency(v.pending)}</td>
                  <td>
                    {v.payoutTerms === 0 ? (
                      <span className="badge badge-confirmed">فوري</span>
                    ) : (
                      <span className="badge badge-preparing">بعد {v.payoutTerms} يوم</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
