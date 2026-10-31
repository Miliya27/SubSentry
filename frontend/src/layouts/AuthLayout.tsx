/**
 * src/layouts/AuthLayout.tsx
 * Centered card layout for authentication pages in the light theme design system.
 */
import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#F8FAFC] p-4 relative">
      {/* Subtle radial gradient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(79,70,229,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-md my-8">
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-primary-600 shadow-md shadow-primary-500/25 mb-3">
            <span className="text-white text-xl font-extrabold tracking-tight">S</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            SubSentry
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Enterprise Subscription & Billing Management
          </p>
        </div>

        {/* Auth form card */}
        <div className="card shadow-sm border border-slate-200">
          <div className="card-body p-6 sm:p-8">
            <Outlet />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} SubSentry. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default AuthLayout;
