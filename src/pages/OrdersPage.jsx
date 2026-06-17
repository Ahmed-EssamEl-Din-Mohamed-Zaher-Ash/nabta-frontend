import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ToastHost.jsx';
import { ROLE_STATUS_FILTER, STATUS_LABELS, getStatusAction } from '../constants/permissions.js';
import { formatCurrency, orderTotals } from '../utils/format.js';
import StatusBadge from '../components/StatusBadge.jsx';
import RoleGate from '../components/RoleGate.jsx';
import OrderDetailsModal from '../components/OrderDetailsModal.jsx';

// Multi-vendor: an order may span several vendors. Show the first + a "+N" badge.
function vendorLabel(o) {
  const vs = o.vendors && o.vendors.length ? o.vendors : o.vendor ? [o.vendor] : [];
  if (!vs.length) return '-';
  const first = vs[0].nameAr || vs[0].name;
  return vs.length > 1 ? `${first} +${vs.length - 1}` : first;
}

export default function OrdersPage() {
  const { role } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [viewedId, setViewedId] = useState(null);

  const allowed = ROLE_STATUS_FILTER[role] || [];

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/orders', { params: { limit: 100 } });
      setOrders(data.orders);
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Same visibility rule as legacy renderOrders(): admin sees all,
  // other roles only the statuses relevant to their stage.
  let visible = role === 'admin' ? orders : orders.filter((o) => allowed.includes(o.status));
  if (statusFilter) visible = visible.filter((o) => o.status === statusFilter);

  async function advance(order) {
    const action = getStatusAction(role, order.status);
    if (!action) return;
    try {
      await api.patch(`/api/orders/${order.id}/status`, { status: action.next });
      showToast(`تم تغيير حالة ${order.orderNumber} إلى: ${STATUS_LABELS[action.next]}`, 'success');
      fetchOrders();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  async function fail(order) {
    try {
      await api.patch(`/api/orders/${order.id}/status`, { status: 'failed', failureReason: 'فشل التسليم' });
      showToast(`تم تسجيل فشل تسليم ${order.orderNumber}`, 'error');
      fetchOrders();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  const viewedOrder = orders.find((o) => o.id === viewedId);

  // Legacy exportByRole: each role gets its own workbook layout
  async function exportExcel() {
    try {
      // xlsx is heavy — load it only when someone actually exports
      const { exportByRole } = await import('../utils/excel.js');
      // /api/drivers is ops/admin-only now; only the ops export needs it.
      const needsDrivers = ['ops', 'admin'].includes(role);
      const reqs = [api.get('/api/vendors'), api.get('/api/customers')];
      if (needsDrivers) reqs.push(api.get('/api/drivers'));
      const [v, c, d] = await Promise.all(reqs);
      exportByRole(role, {
        orders,
        vendors: v.data.vendors,
        customers: c.data.customers,
        drivers: needsDrivers ? d.data.drivers : [],
      });
      showToast('تم تصدير الملف بنجاح', 'success');
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  }

  return (
    <>
      <div className="page-toolbar">
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{visible.length} طلب</h3>
        <div className="toolbar-right">
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">كل الحالات</option>
            {allowed.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <RoleGate roles={['sales', 'admin']}>
            <button className="btn btn-primary" onClick={() => navigate('/add-order')}>
              + إضافة طلب
            </button>
          </RoleGate>
          <RoleGate roles={['sales', 'account', 'ops', 'finance', 'admin']}>
            <button className="btn btn-secondary" onClick={exportExcel} title="تصدير Excel حسب مرحلتك">
              <i className="fa-solid fa-file-excel" aria-hidden="true" /> تصدير Excel
            </button>
          </RoleGate>
          <RoleGate roles={['admin']}>
            <button
              className="btn btn-primary btn-sm"
              title="مراجعة دورة الحياة الكاملة"
              onClick={() => navigate('/cycle-audit')}
            >
              <i className="fa-solid fa-rotate" aria-hidden="true" /> مراجعة الدورة
            </button>
          </RoleGate>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>رقم الطلب</th><th>العميل</th><th>المورد</th><th>الحالة</th>
                <th>الإجمالي</th><th>التاريخ</th><th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="loading"><div className="spinner" /></div></td></tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state" style={{ padding: 30 }}>
                      <h3>لا توجد طلبات</h3>
                    </div>
                  </td>
                </tr>
              ) : (
                visible.map((o) => (
                  <tr key={o.id}>
                    <td><strong>{o.orderNumber}</strong></td>
                    <td>{o.customer?.name || '-'}</td>
                    <td>{vendorLabel(o)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>{formatCurrency(orderTotals(o).total)}</td>
                    <td>{o.date}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-info btn-sm" onClick={() => setViewedId(o.id)}>عرض</button>
                        <RoleGate status={o.status}>
                          {(action) => (
                            <button className="btn btn-primary btn-sm" onClick={() => advance(o)}>
                              {action.label}
                            </button>
                          )}
                        </RoleGate>
                        {o.status === 'out' && ['ops', 'admin'].includes(role) && (
                          <button className="btn btn-danger btn-sm" onClick={() => fail(o)}>فشل التسليم</button>
                        )}
                        {o.status === 'new' && ['sales', 'admin'].includes(role) && (
                          <button className="btn btn-warning btn-sm" onClick={() => navigate(`/add-order?edit=${o.id}`)}>
                            تعديل
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewedOrder && (
        <OrderDetailsModal order={viewedOrder} onClose={() => setViewedId(null)} onChanged={fetchOrders} />
      )}
    </>
  );
}
