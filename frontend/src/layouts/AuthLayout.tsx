/**
 * src/layouts/AuthLayout.tsx
 * Centered card layout for login / registration pages.
 */
import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-950 p-4">
      {/* Subtle radial gradient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(79,70,229,0.15) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-primary-600 shadow-lg shadow-primary-900/50 mb-3">
            <span className="text-white text-xl font-extrabold">S</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            SubSentry
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Subscription management platform
          </p>
        </div>

        {/* Page-specific content */}
        <div className="card">
          <div className="card-body">
            <Outlet />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} SubSentry. All rights reserved.
        </p>
      </div>
    </div>
  );
}
