/**
 * src/App.tsx
 * Root router configuration for SubSentry.
 * Uses React Router v6 data router (createBrowserRouter).
 */
import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { PageSpinner } from './components/Spinner';

// ─── Lazy-loaded pages ──────────────────────────────────────────────────────
const LoginPage          = lazy(() => import('./pages/LoginPage'));
const DashboardPage      = lazy(() => import('./pages/DashboardPage'));
const CustomersPage      = lazy(() => import('./pages/CustomersPage'));
const ProductsPage       = lazy(() => import('./pages/ProductsPage'));
const PlansPage          = lazy(() => import('./pages/PlansPage'));
const QuotationsPage     = lazy(() => import('./pages/QuotationsPage'));
const SubscriptionsPage  = lazy(() => import('./pages/SubscriptionsPage'));
const InvoicesPage       = lazy(() => import('./pages/InvoicesPage'));
const PaymentsPage       = lazy(() => import('./pages/PaymentsPage'));
const DiscountsPage      = lazy(() => import('./pages/DiscountsPage'));
const TaxesPage          = lazy(() => import('./pages/TaxesPage'));
const ReportsPage        = lazy(() => import('./pages/ReportsPage'));
const SettingsPage       = lazy(() => import('./pages/SettingsPage'));
const MySubscriptionsPage = lazy(() => import('./pages/MySubscriptionsPage'));
const MyInvoicesPage     = lazy(() => import('./pages/MyInvoicesPage'));
const NotFoundPage       = lazy(() => import('./pages/NotFoundPage'));

// ─── Suspense wrapper ───────────────────────────────────────────────────────
function SuspensePage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSpinner />}>{children}</Suspense>;
}

// ─── Router ─────────────────────────────────────────────────────────────────
const router = createBrowserRouter([
  // ── Public / Auth routes ──────────────────────────────────────────────
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: <SuspensePage><LoginPage /></SuspensePage>,
      },
    ],
  },

  // ── Authenticated app routes ──────────────────────────────────────────
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard',    element: <SuspensePage><DashboardPage /></SuspensePage> },
      { path: '/customers',    element: <SuspensePage><CustomersPage /></SuspensePage> },
      { path: '/products',     element: <SuspensePage><ProductsPage /></SuspensePage> },
      { path: '/plans',        element: <SuspensePage><PlansPage /></SuspensePage> },
      { path: '/quotations',   element: <SuspensePage><QuotationsPage /></SuspensePage> },
      { path: '/subscriptions', element: <SuspensePage><SubscriptionsPage /></SuspensePage> },
      { path: '/invoices',     element: <SuspensePage><InvoicesPage /></SuspensePage> },
      { path: '/payments',     element: <SuspensePage><PaymentsPage /></SuspensePage> },
      { path: '/discounts',    element: <SuspensePage><DiscountsPage /></SuspensePage> },
      { path: '/taxes',        element: <SuspensePage><TaxesPage /></SuspensePage> },
      { path: '/reports',      element: <SuspensePage><ReportsPage /></SuspensePage> },
      { path: '/settings',     element: <SuspensePage><SettingsPage /></SuspensePage> },
      // Customer-facing
      { path: '/my/subscriptions', element: <SuspensePage><MySubscriptionsPage /></SuspensePage> },
      { path: '/my/invoices',      element: <SuspensePage><MyInvoicesPage /></SuspensePage> },
    ],
  },

  // ── 404 ──────────────────────────────────────────────────────────────────
  {
    path: '*',
    element: <SuspensePage><NotFoundPage /></SuspensePage>,
  },
]);

// ─── Root App component ──────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
