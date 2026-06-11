import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ToastHost.jsx';
import { ROLE_LABELS, REPORT_ROLES } from '../constants/permissions.js';
import { formatCurrency, orderTotals } from '../utils/format.js';
import StatusBadge from '../components/StatusBadge.jsx';
import OrderDetailsModal from '../components/OrderDetailsModal.jsx';

// Per-role stat cards — same labels/colors/icons as legacy statsMap,
// computed from GET /api/reports/dashboard (counts + financials).
function buildStats(role, counts, financials, customersCount) {
  const c = counts;
  // Roles outside REPORT_ROLES have no financials; the map below evaluates
  // every role branch eagerly, so null must not reach f.totalRevenue.
  const f = financials ?? { totalRevenue: 0, pendingPayment: 0, totalPaid: 0 };
  const card = (icon, label, value, color, bg) => ({ icon, label, value, color, bg });

  const map = {
    admin: [
      card('fa-clipboard-list', 'إجمالي الأوردرات', c.total, 'var(--blue)', 'var(--blue-light)'),
      card('fa-bell', 'أوردرات جديدة', c.new, 'var(--orange)', 'var(--orange-light)'),
      card('fa-truck', 'في التوصيل', c.out, 'var(--purple)', 'var(--purple-light)'),
      card('fa-check', 'تم التسليم', c.delivered, 'var(--green-600)', 'var(--green-100)'),
      card('fa-coins', 'الإيراد الكلي', formatCurrency(f.totalRevenue), 'var(--green-700)', 'var(--green-100)'),
      card('fa-hourglass-half', 'مستحق للموردين', formatCurrency(f.pendingPayment), 'var(--red)', 'var(--red-light)'),
    ],
    sales: [
      card('fa-clipboard-list', 'أوردراتي', c.new + c.confirmed, 'var(--blue)', 'var(--blue-light)'),
      card('fa-bell', 'جديدة', c.new, 'var(--orange)', 'var(--orange-light)'),
      card('fa-check', 'مؤكدة', c.confirmed, 'var(--green-600)', 'var(--green-100)'),
      card('fa-users', 'عملاء', customersCount, 'var(--purple)', 'var(--purple-light)'),
    ],
    account: [
      card('fa-box', 'قيد المتابعة', c.confirmed + c.preparing + c.ready, 'var(--blue)', 'var(--blue-light)'),
      card('fa-check', 'مؤكدة', c.confirmed, 'var(--orange)', 'var(--orange-light)'),
      card('fa-screwdriver-wrench', 'جاري التحضير', c.preparing, 'var(--yellow)', 'var(--yellow-light)'),
      card('fa-box', 'جاهزة', c.ready, 'var(--green-600)', 'var(--green-100)'),
    ],
    ops: [
      card('fa-box', 'جاهزة للتوصيل', c.ready, 'var(--blue)', 'var(--blue-light)'),
      card('fa-truck', 'في الطريق', c.out, 'var(--orange)', 'var(--orange-light)'),
      card('fa-check', 'تم التسليم', c.delivered, 'var(--green-600)', 'var(--green-100)'),
      card('fa-xmark', 'فشل التسليم', c.failed, 'var(--red)', 'var(--red-light)'),
    ],
    finance: [
      card('fa-hourglass-half', 'بانتظار الدفع', c.delivered, 'var(--orange)', 'var(--orange-light)'),
      card('fa-check', 'تم الدفع', c.paid, 'var(--green-600)', 'var(--green-100)'),
      card('fa-coins', 'مستحق للموردين', formatCurrency(f.pendingPayment), 'var(--red)', 'var(--red-light)'),
      // paid total = revenue of (delivered+paid) minus revenue still pending (delivered)
      card('fa-money-bill-wave', 'إجمالي المدفوع', formatCurrency(f.totalRevenue - f.pendingPayment), 'var(--blue)', 'var(--blue-light)'),
    ],
    driver: [
      card('fa-truck', 'أوردراتي اليوم', c.out, 'var(--orange)', 'var(--orange-light)'),
      card('fa-check', 'تم تسليمها', c.delivered, 'var(--green-600)', 'var(--green-100)'),
    ],
  };
  return map[role] || map.admin;
}

export default function DashboardPage() {
  const { user, role } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewedId, setViewedId] = useState(null);

  // Statuses each non-report role's cards need (see buildStats above).
  const FALLBACK_COUNT_STATUSES = {
    ops: ['ready', 'out', 'delivered', 'failed'],
    driver: ['out', 'delivered'],
  };

  async function fetchStats() {
    if (REPORT_ROLES.includes(role)) {
      const requests = [api.get('/api/reports/dashboard')];
      if (role === 'sales') requests.push(api.get('/api/customers'));
      const [dash, cust] = await Promise.all(requests);
      return buildStats(role, dash.data.counts, dash.data.financials, cust?.data.customers.length ?? 0);
    }
    // ops/driver are blocked from /api/reports/* — count their cards from
    // status-filtered orders queries instead. A driver's list is already
    // server-scoped to their own orders, so these are personal counts.
    const statuses = FALLBACK_COUNT_STATUSES[role] ?? [];
    const results = await Promise.all(
      statuses.map((status) => api.get('/api/orders', { params: { status, limit: 1 } }))
    );
    const counts = Object.fromEntries(statuses.map((s, i) => [s, results[i].data.pagination.total]));
    return buildStats(role, counts, null, 0);
  }

  async function load() {
    setLoading(true);
    // Stats and the recent-orders table load independently: one failing
    // must not blank the other or wedge the spinner.
    const [statsRes, recentRes] = await Promise.allSettled([
      fetchStats(),
      api.get('/api/orders', { params: { limit: 5 } }),
    ]);
    if (statsRes.status === 'fulfilled') setStats(statsRes.value);
    if (recentRes.status === 'fulfilled') setRecent(recentRes.value.data.orders);
    const failure = [statsRes, recentRes].find((r) => r.status === 'rejected');
    if (failure) showToast(apiErrorMessage(failure.reason), 'error');
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const viewedOrder = recent.find((o) => o.id === viewedId);

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--gray-800)' }}>
          مرحباً، {user?.name} <i className="fa-solid fa-hand" aria-hidden="true" />
        </h2>
        <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>{ROLE_LABELS[role]} — لوحة التحكم</p>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : !stats ? null : (
        <div className="stats-grid" style={{ marginTop: 20 }}>
          {stats.map((s) => (
            <div className="stat-card" key={s.label}>
              <div className="stat-icon" style={{ background: s.bg }}>
                <span style={{ fontSize: 22, color: s.color }}>
                  <i className={`fa-solid ${s.icon}`} aria-hidden="true" />
                </span>
              </div>
              <div className="stat-info">
                <h3>{s.value}</h3>
                <p>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>آخر الأوردرات</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/orders')}>عرض الكل</button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>رقم الأوردر</th><th>العميل</th><th>الحالة</th><th>الإجمالي</th><th>التاريخ</th><th>إجراءات</th></tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state" style={{ padding: 20 }}><p>لا توجد أوردرات</p></div></td></tr>
              ) : (
                recent.map((o) => (
                  <tr key={o.id}>
                    <td><strong>{o.orderNumber}</strong></td>
                    <td>{o.customer?.name || '-'}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>{formatCurrency(orderTotals(o).total)}</td>
                    <td>{o.date}</td>
                    <td>
                      <button className="btn btn-info btn-sm" onClick={() => setViewedId(o.id)}>عرض</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewedOrder && (
        <OrderDetailsModal order={viewedOrder} onClose={() => setViewedId(null)} onChanged={load} />
      )}
    </>
  );
}
