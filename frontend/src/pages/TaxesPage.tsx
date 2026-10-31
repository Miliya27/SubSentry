/**
 * src/pages/TaxesPage.tsx (admin only)
 */
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

export default function TaxesPage() {
  return (
    <div>
      <PageHeader
        title="Taxes"
        subtitle="Configure tax rates for invoices"
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} id="add-tax-button">Add Tax</Button>}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Taxes' }]}
      />
      <Card><CardBody className="p-0"><EmptyState title="No tax rules yet" description="Define GST, IGST, VAT or custom tax rates." /></CardBody></Card>
    </div>
  );
}
