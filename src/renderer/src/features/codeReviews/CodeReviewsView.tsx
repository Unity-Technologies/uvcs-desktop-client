import { Construction } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';

export function CodeReviewsView() {
  return <EmptyState icon={<Construction size={22} />} title="Code reviews" description="This area is being built." />;
}
