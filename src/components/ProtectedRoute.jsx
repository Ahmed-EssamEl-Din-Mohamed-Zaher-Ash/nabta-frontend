import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { canAccessPage } from '../constants/permissions.js';

/**
 * Route-level guard.
 * - Not logged in → redirect to /login (remembering where they came from).
 * - Logged in but `page` is outside the role's ROLE_PAGES → redirect to /dashboard
 *   (same behavior as legacy navigate(): access silently refused).
 */
export default function ProtectedRoute({ page, children }) {
  const { isAuthenticated, role, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (page && !canAccessPage(role, page)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
