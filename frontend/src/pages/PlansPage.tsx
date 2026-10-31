/**
 * src/pages/PlansPage.tsx
 */
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

export default function PlansPage() {
  return (
    <div>
      <PageHeader
        title="Plans"
        subtitle="Define subscription plans and pricing tiers"
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} id="add-plan-button">Add Plan</Button>}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Plans' }]}
      />
      <Card><CardBody className="p-0"><EmptyState title="No plans yet" description="Create your first subscription plan." /></CardBody></Card>
    </div>
  );
}
