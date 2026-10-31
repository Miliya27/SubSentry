/**
 * src/pages/PaymentsPage.tsx
 */
import { PageHeader } from '../components/PageHeader';
import { Card, CardBody } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

export default function PaymentsPage() {
  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Review all payment transactions"
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Payments' }]}
      />
      <Card><CardBody className="p-0"><EmptyState title="No payments yet" description="Payment records will appear here." /></CardBody></Card>
    </div>
  );
}
