import { useAuth } from '../context/AuthContext.jsx';
import { getStatusAction } from '../constants/permissions.js';

/**
 * Element-level guard: renders children only when the current role is allowed.
 *
 *   <RoleGate roles={['sales', 'admin']}><button>إضافة أوردر</button></RoleGate>
 *
 * For order-status buttons, use the render-prop form driven by STATUS_FLOW —
 * it yields the exact action (next status + Arabic label) the role may perform:
 *
 *   <RoleGate status={order.status}>
 *     {(action) => <button onClick={() => advance(action.next)}>{action.label}</button>}
 *   </RoleGate>
 */
export default function RoleGate({ roles, status, children }) {
  const { role } = useAuth();

  if (status !== undefined) {
    const action = getStatusAction(role, status);
    if (!action) return null;
    return typeof children === 'function' ? children(action) : children;
  }

  if (!roles?.includes(role)) return null;
  return children;
}
