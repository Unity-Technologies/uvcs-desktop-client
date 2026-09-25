import { Construction } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';

export function ChangesetsView() {
  return <EmptyState icon={<Construction size={22} />} title="Changesets" description="This area is being built." />;
}
