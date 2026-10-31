/**
 * src/App.tsx
 * Root router configuration with complete authentication flow,
 * Product & Plan management routes, and ProtectedRoute guards.
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
const CustomerFormPage    = lazy(() => import('./pages/CustomerFormPage'));
const ProductsPage        = lazy(() => import('./pages/ProductsPage'));
const ProductFormPage     = lazy(() => import('./pages/ProductFormPage'));
const PlansPage           = lazy(() => import('./pages/PlansPage'));
const PlanFormPage        = lazy(() => import('./pages/PlanFormPage'));
const QuotationsPage      = lazy(() => import('./pages/QuotationsPage'));
const QuotationTemplatesPage = lazy(() => import('./pages/QuotationTemplatesPage'));
const TemplateFormPage    = lazy(() => import('./pages/TemplateFormPage'));
const SubscriptionsPage   = lazy(() => import('./pages/SubscriptionsPage'));
const SubscriptionFormPage = lazy(() => import('./pages/SubscriptionFormPage'));
const SubscriptionDetailPage = lazy(() => import('./pages/SubscriptionDetailPage'));
const InvoicesPage        = lazy(() => import('./pages/InvoicesPage'));
const InvoiceDetailPage  = lazy(() => import('./pages/InvoiceDetailPage'));
const InvoicePrintPage   = lazy(() => import('./pages/InvoicePrintPage'));
const BillingRunPage     = lazy(() => import('./pages/BillingRunPage'));
const PaymentsPage        = lazy(() => import('./pages/PaymentsPage'));
const DiscountsPage       = lazy(() => import('./pages/DiscountsPage'));
const DiscountFormPage   = lazy(() => import('./pages/DiscountFormPage'));
const TaxesPage           = lazy(() => import('./pages/TaxesPage'));
const ReportsPage         = lazy(() => import('./pages/ReportsPage'));
const SettingsPage        = lazy(() => import('./pages/SettingsPage'));
const MySubscriptionsPage = lazy(() => import('./pages/MySubscriptionsPage'));
const MyInvoicesPage      = lazy(() => import('./pages/MyInvoicesPage'));
const CustomerPortalPage  = lazy(() => import('./pages/CustomerPortalPage'));
const NotFoundPage        = lazy(() => import('./pages/NotFoundPage'));

// ─── Suspense wrapper ───────────────────────────────────────────────────────
function SuspensePage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSpinner />}>{children}</Suspense>;
}

// ─── Dynamic Index Redirect ────────────────────────────────────────────────
function IndexRedirect() {
  const { user } = useAuth();
  if (user?.role === 'customer') {
    return <Navigate to="/portal" replace />;
  }
  return <Navigate to="/dashboard" replace />;
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

  // ── Authenticated app routes ──────────────────────────────────────────
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <IndexRedirect /> },

      // Dashboard
      {
        path: '/dashboard',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><DashboardPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },

      // Customers
      {
        path: '/customers',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><CustomersPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/customers/new',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><CustomerFormPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/customers/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><CustomerFormPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },

      // Products & Product Form
      {
        path: '/products',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><ProductsPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/products/new',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <SuspensePage><ProductFormPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/products/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><ProductFormPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },

      // Plans & Plan Form
      {
        path: '/plans',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><PlansPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/plans/new',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <SuspensePage><PlanFormPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/plans/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><PlanFormPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },

      // Quotations & Quotation Templates
      {
        path: '/quotations',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><QuotationsPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/quotations/templates',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><QuotationTemplatesPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/quotations/templates/new',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><TemplateFormPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/quotations/templates/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><TemplateFormPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },

      // Subscriptions
      {
        path: '/subscriptions',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><SubscriptionsPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/subscriptions/new',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><SubscriptionFormPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/subscriptions/:id',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><SubscriptionDetailPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },

      // Invoices
      {
        path: '/invoices',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><InvoicesPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/invoices/:id',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><InvoiceDetailPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/invoices/:id/print',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff', 'customer']}>
            <SuspensePage><InvoicePrintPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/billing/run',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <SuspensePage><BillingRunPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },

      // Payments
      {
        path: '/payments',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <SuspensePage><PaymentsPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },

      // Reports
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
        path: '/discounts/new',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <SuspensePage><DiscountFormPage /></SuspensePage>
          </ProtectedRoute>
        ),
      },
      {
        path: '/discounts/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <SuspensePage><DiscountFormPage /></SuspensePage>
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
      {
        path: '/portal',
        element: (
          <ProtectedRoute allowedRoles={['customer']}>
            <SuspensePage><CustomerPortalPage /></SuspensePage>
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
