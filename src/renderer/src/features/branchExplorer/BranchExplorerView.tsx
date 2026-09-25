import { Construction } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';

export function BranchExplorerView() {
  return <EmptyState icon={<Construction size={22} />} title="Branch Explorer" description="This area is being built." />;
}
