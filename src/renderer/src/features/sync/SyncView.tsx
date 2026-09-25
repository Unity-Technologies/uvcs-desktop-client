import { Construction } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';

export function SyncView() {
  return <EmptyState icon={<Construction size={22} />} title="Sync" description="This area is being built." />;
}
