import { Construction } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';

export function FilesView() {
  return <EmptyState icon={<Construction size={22} />} title="Files" description="This area is being built." />;
}
