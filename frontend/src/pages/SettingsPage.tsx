/**
 * src/pages/SettingsPage.tsx (admin only)
 */
import { PageHeader } from '../components/PageHeader';
import { Card, CardBody } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Platform configuration and preferences"
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Settings' }]}
      />
      <Card><CardBody className="p-0"><EmptyState title="Settings coming soon" description="Platform settings will be available in a later stage." /></CardBody></Card>
    </div>
  );
}
