/**
 * src/pages/MySubscriptionsPage.tsx (customer role)
 */
import { PageHeader } from '../components/PageHeader';
import { Card, CardBody } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

export default function MySubscriptionsPage() {
  return (
    <div>
      <PageHeader
        title="My Subscriptions"
        subtitle="Your active and past subscriptions"
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'My Subscriptions' }]}
      />
      <Card><CardBody className="p-0"><EmptyState title="No subscriptions" description="You don't have any subscriptions yet." /></CardBody></Card>
    </div>
  );
}
