/**
 * src/pages/CustomersPage.tsx
 */
import { UserPlus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

export default function CustomersPage() {
  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Manage your customer accounts"
        actions={
          <Button leftIcon={<UserPlus className="h-4 w-4" />} id="add-customer-button">
            Add Customer
          </Button>
        }
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Customers' }]}
      />
      <Card>
        <CardBody className="p-0">
          <EmptyState
            title="No customers yet"
            description="Add your first customer to get started."
            actionLabel="Add Customer"
          />
        </CardBody>
      </Card>
    </div>
  );
}
