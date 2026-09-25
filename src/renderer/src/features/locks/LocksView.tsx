import { Construction } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';

export function LocksView() {
  return <EmptyState icon={<Construction size={22} />} title="Locks" description="This area is being built." />;
}
