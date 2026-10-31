/**
 * src/pages/QuotationsPage.tsx
 */
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

export default function QuotationsPage() {
  return (
    <div>
      <PageHeader
        title="Quotation Templates"
        subtitle="Manage reusable quotation templates"
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} id="add-quotation-button">New Template</Button>}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Quotation Templates' }]}
      />
      <Card><CardBody className="p-0"><EmptyState title="No templates yet" description="Create your first quotation template." /></CardBody></Card>
    </div>
  );
}
