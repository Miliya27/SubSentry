/**
 * src/pages/DiscountsPage.tsx (admin only)
 */
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

export default function DiscountsPage() {
  return (
    <div>
      <PageHeader
        title="Discounts"
        subtitle="Create and manage discount codes"
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} id="add-discount-button">Add Discount</Button>}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Discounts' }]}
      />
      <Card><CardBody className="p-0"><EmptyState title="No discounts yet" description="Create discount codes to offer to customers." /></CardBody></Card>
    </div>
  );
}
