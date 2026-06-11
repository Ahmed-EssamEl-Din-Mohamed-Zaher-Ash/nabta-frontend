import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import AddOrderPage from './pages/AddOrderPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import VendorsPage from './pages/VendorsPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import DriversPage from './pages/DriversPage.jsx';
import VehiclesPage from './pages/VehiclesPage.jsx';
import RoutesPage from './pages/RoutesPage.jsx';
import UsersPage from './pages/UsersPage.jsx';

// Map & chart pages pull in Leaflet/Chart.js — code-split so the core app stays light
const TrackingMapPage = lazy(() => import('./pages/TrackingMapPage.jsx'));
const DriverTrackingPage = lazy(() => import('./pages/DriverTrackingPage.jsx'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage.jsx'));
const PublicTrackPage = lazy(() => import('./pages/PublicTrackPage.jsx'));
const CycleAuditPage = lazy(() => import('./pages/CycleAuditPage.jsx'));

const lazyFallback = <div className="loading"><div className="spinner" /></div>;

// page key → element (keys mirror ROLE_PAGES / NAV_ITEMS)
const PAGE_ELEMENTS = {
  dashboard: <DashboardPage />,
  orders: <OrdersPage />,
  'add-order': <AddOrderPage />,
  products: <ProductsPage />,
  vendors: <VendorsPage />,
  customers: <CustomersPage />,
  drivers: <DriversPage />,
  vehicles: <VehiclesPage />,
  routes: <RoutesPage />,
  'tracking-map': <TrackingMapPage />,
  'driver-tracking': <DriverTrackingPage />,
  analytics: <AnalyticsPage />,
  'cycle-audit': <CycleAuditPage />,
  users: <UsersPage />,
};

export default function App() {
  return (
    <Suspense fallback={lazyFallback}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Public customer tracking — no auth; the topic UUID is the credential */}
      <Route path="/track/:topic" element={<PublicTrackPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        {Object.entries(PAGE_ELEMENTS).map(([page, element]) => (
          <Route
            key={page}
            path={`/${page}`}
            element={<ProtectedRoute page={page}>{element}</ProtectedRoute>}
          />
        ))}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  );
}
