import { Construction } from 'lucide-react';
import type { PageProps } from '../../app/navigation/pages';
import { EmptyState } from '../../ui/EmptyState';

export function CodeReviewPage(_props: PageProps<'codeReview'>) {
  return <EmptyState icon={<Construction size={22} />} title="Code review" description="This area is being built." />;
}
