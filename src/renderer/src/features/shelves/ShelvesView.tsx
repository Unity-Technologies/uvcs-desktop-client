import { Construction } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';

export function ShelvesView() {
  return <EmptyState icon={<Construction size={22} />} title="Shelves" description="This area is being built." />;
}
