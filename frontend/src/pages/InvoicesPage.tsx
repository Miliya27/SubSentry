/**
 * src/pages/InvoicesPage.tsx
 */
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

export default function InvoicesPage() {
  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="View and manage all invoices"
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} id="create-invoice-button">Create Invoice</Button>}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Invoices' }]}
      />
      <Card><CardBody className="p-0"><EmptyState title="No invoices yet" description="Invoices will appear here once created." /></CardBody></Card>
    </div>
  );
}
