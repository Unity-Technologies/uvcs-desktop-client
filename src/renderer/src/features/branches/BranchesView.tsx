import { Construction } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';

export function BranchesView() {
  return <EmptyState icon={<Construction size={22} />} title="Branches" description="This area is being built." />;
}
