import { Construction } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';

export function IncomingChangesView() {
  return <EmptyState icon={<Construction size={22} />} title="Incoming changes" description="This area is being built." />;
}
