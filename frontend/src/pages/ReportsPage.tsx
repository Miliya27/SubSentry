/**
 * src/pages/ReportsPage.tsx
 */
import { PageHeader } from '../components/PageHeader';
import { Card, CardBody } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Analytics and business reports"
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Reports' }]}
      />
      <Card><CardBody className="p-0"><EmptyState title="No reports yet" description="Reports will be available in a later stage." /></CardBody></Card>
    </div>
  );
}
