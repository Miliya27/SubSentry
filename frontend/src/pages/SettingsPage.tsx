/**
 * src/pages/SettingsPage.tsx (admin only)
 * Platform configuration and administrator settings view.
 */
import { useEffect } from 'react';
import { User, Server } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { Card, CardHeader, CardBody } from '../components/Card';

export default function SettingsPage() {
  const { user } = useAuth();

  useEffect(() => {
    document.title = 'Settings | SubSentry';
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Settings"
        subtitle="Platform configuration, system preferences, and session context"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Settings' },
        ]}
      />

      {/* Admin Session Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">Current Administrator Profile</h2>
          </div>
        </CardHeader>
        <CardBody className="p-4 text-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <span className="text-slate-500">Name</span>
            <p className="font-semibold text-slate-900 mt-1">{user?.full_name}</p>
          </div>
          <div>
            <span className="text-slate-500">Email</span>
            <p className="font-semibold text-slate-900 mt-1">{user?.email}</p>
          </div>
          <div>
            <span className="text-slate-500">Role</span>
            <p className="font-mono text-indigo-600 uppercase font-bold mt-1">{user?.role}</p>
          </div>
        </CardBody>
      </Card>

      {/* System Environment */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">System Environment & Contract</h2>
          </div>
        </CardHeader>
        <CardBody className="p-4 text-xs space-y-3">
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-600 font-medium">API Contract Version:</span>
            <span className="font-mono text-slate-900 font-semibold">1.1.0</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-600 font-medium">Backend Base URL:</span>
            <span className="font-mono text-indigo-600 font-semibold">http://localhost:8000/api/v1</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-600 font-medium">Primary Currency:</span>
            <span className="font-mono text-slate-900 font-semibold">INR (₹)</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-600 font-medium">Design Theme:</span>
            <span className="font-medium text-emerald-600 font-semibold">Light Theme (#F8FAFC / Indigo #4F46E5)</span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
