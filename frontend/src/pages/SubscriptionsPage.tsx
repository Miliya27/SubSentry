/**
 * src/pages/SubscriptionsPage.tsx
 */
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

export default function SubscriptionsPage() {
  return (
    <div>
      <PageHeader
        title="Subscriptions"
        subtitle="Track and manage all customer subscriptions"
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} id="add-subscription-button">New Subscription</Button>}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Subscriptions' }]}
      />
      <Card><CardBody className="p-0"><EmptyState title="No subscriptions yet" description="Create a subscription to get started." /></CardBody></Card>
    </div>
  );
}
