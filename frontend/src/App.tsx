/**
 * src/App.tsx
 * Root router configuration with complete authentication flow and ProtectedRoute guards.
 */
import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PageSpinner } from './components/Spinner';

// ─── Lazy-loaded Auth Pages ────────────────────────────────────────────────
const LoginPage          = lazy(() => import('./pages/LoginPage'));
const RegisterPage       = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage'));

// ─── Lazy-loaded App Pages ─────────────────────────────────────────────────
const DashboardPage       = lazy(() => import('./pages/DashboardPage'));
const CustomersPage       = lazy(() => import('./pages/CustomersPage'));
const ProductsPage        = lazy(() => import('./pages/ProductsPage'));
const PlansPage           = lazy(() => import('./pages/PlansPage'));
const QuotationsPage      = lazy(() => import('./pages/QuotationsPage'));
const SubscriptionsPage   = lazy(() => import('./pages/SubscriptionsPage'));
const InvoicesPage        = lazy(() => import('./pages/InvoicesPage'));
const PaymentsPage        = lazy(() => import('./pages/PaymentsPage'));
const DiscountsPage       = lazy(() => import('./pages/DiscountsPage'));
const TaxesPage           = lazy(() => import('./pages/TaxesPage'));
const ReportsPage         = lazy(() => import('./pages/ReportsPage'));
const SettingsPage        = lazy(() => import('./pages/SettingsPage'));
const MySubscriptionsPage = lazy(() => import('./pages/MySubscriptionsPage'));
const MyInvoicesPage      = lazy(() => import('./pages/MyInvoicesPage'));
const NotFoundPage        = lazy(() => import('./pages/NotFoundPage'));

// ─── Suspense wrapper ───────────────────────────────────────────────────────
function SuspensePage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSpinner />}>{children}</Suspense>;
}

// ─── Dynamic Index Redirect ────────────────────────────────────────────────
function IndexRedirect() {
  const { user } = useAuth();
  if (user?.role === 'customer') {
    return <Navigate to="/my/subscriptions" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

// ─── Customer Portal Redirection ───────────────────────────────────────────
function CustomerPortalRedirect() {
  return <Navigate to="/my/subscriptions" replace />;
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
      {
        path: '/register',
        element: <SuspensePage><RegisterPage /></SuspensePage>,
      },
      {
        path: '/forgot-password',
        element: <SuspensePage><ForgotPasswordPage /></SuspensePage>,
      },
      {
        path: '/reset-password',
        element: <SuspensePage><ResetPasswordPage /></SuspensePage>,
      },
    ],
  },

  // ── Customer Portal alias (/portal) ───────────────────────────────────
  {
    path: '/portal',
    element: (
      <ProtectedRoute allowedRoles={['customer']}>
        <CustomerPortalRedirect />
      </ProtectedRoute>
    ),
  },

  // ── Authenticated app routes ──────────────────────────────────────────
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <IndexRedirect /> },

      // Admin & Staff routes
      {
        path: '/dashboard',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><DashboardPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/customers',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><CustomersPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/products',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><ProductsPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/plans',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><PlansPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/quotations',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><QuotationsPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/subscriptions',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><SubscriptionsPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/invoices',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><InvoicesPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/payments',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><PaymentsPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/reports',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><ReportsPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },

      // Admin-only routes
      {
        path: '/discounts',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <SuspensePage><DiscountsPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/taxes',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <SuspensePage><TaxesPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/settings',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <SuspensePage><SettingsPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },

      // Customer-only routes
      {
        path: '/my/subscriptions',
        element: (
          <ProtectedRoute allowedRoles={['customer']}>
            <SuspensePage><MySubscriptionsPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/my/invoices',
        element: (
          <ProtectedRoute allowedRoles={['customer']}>
            <SuspensePage><MyInvoicesPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
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
