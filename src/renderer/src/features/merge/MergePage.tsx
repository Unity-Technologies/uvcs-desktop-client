import { Construction } from 'lucide-react';
import type { PageProps } from '../../app/navigation/pages';
import { EmptyState } from '../../ui/EmptyState';

export function MergePage(_props: PageProps<'merge'>) {
  return <EmptyState icon={<Construction size={22} />} title="Merge" description="This area is being built." />;
}
