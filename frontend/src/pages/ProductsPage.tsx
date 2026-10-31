/**
 * src/pages/ProductsPage.tsx
 */
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

export default function ProductsPage() {
  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage your product catalogue"
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} id="add-product-button">Add Product</Button>}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Products' }]}
      />
      <Card><CardBody className="p-0"><EmptyState title="No products yet" description="Create your first product to include in plans." /></CardBody></Card>
    </div>
  );
}
