/**
 * src/pages/DashboardPage.tsx
 */
import { BarChart2, Users, Receipt, DollarSign } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/Card';

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your subscription business"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Customers"   value="—" icon={<Users className="h-5 w-5" />}   trend={{ value: 0, label: 'this month' }} />
        <StatCard title="Active Subscriptions" value="—" icon={<Receipt className="h-5 w-5" />} trend={{ value: 0, label: 'this month' }} />
        <StatCard title="Revenue (MRR)"     value="—" icon={<DollarSign className="h-5 w-5" />} trend={{ value: 0, label: 'vs last month' }} />
        <StatCard title="Overdue Invoices"  value="—" icon={<BarChart2 className="h-5 w-5" />} />
      </div>
      <p className="text-sm text-slate-500 text-center py-8">
        Charts and recent activity will be added in a later stage.
      </p>
    </div>
  );
}
