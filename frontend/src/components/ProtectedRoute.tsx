/**
 * src/components/ProtectedRoute.tsx
 * Route guard that requires authentication and enforces RBAC:
 * - Redirects unauthenticated users to /login (preserving intended destination)
 * - Shows a friendly Forbidden screen when the user's role is not allowed
 */
import React from 'react';
import { Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PageSpinner } from './Spinner';
import { Button } from './Button';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children?: React.ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Wait for initial session validation from localStorage / backend
  if (isLoading) {
    return <PageSpinner />;
  }

  // Unauthenticated -> redirect to /login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role authorization
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const homePath = user.role === 'customer' ? '/my/subscriptions' : '/dashboard';
    const homeLabel = user.role === 'customer' ? 'My Subscriptions' : 'Dashboard';

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center p-8 space-y-5 animate-scale-in">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-8 ring-rose-50/50">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">403 – Access Restricted</h2>
            <p className="mt-2 text-sm text-slate-600">
              Your account with role <span className="font-semibold text-slate-800 capitalize">{user.role}</span> does
              not have permission to view this section.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="primary"
              onClick={() => navigate(homePath)}
              id="forbidden-home-button"
            >
              <ArrowLeft className="h-4 w-4" /> Go to {homeLabel}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              id="forbidden-logout-button"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
}

export default ProtectedRoute;
