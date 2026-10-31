/**
 * src/pages/MyInvoicesPage.tsx (customer role)
 */
import { PageHeader } from '../components/PageHeader';
import { Card, CardBody } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

export default function MyInvoicesPage() {
  return (
    <div>
      <PageHeader
        title="My Invoices"
        subtitle="Your billing history"
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'My Invoices' }]}
      />
      <Card><CardBody className="p-0"><EmptyState title="No invoices" description="Your invoices will appear here." /></CardBody></Card>
    </div>
  );
}
