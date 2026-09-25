import { Construction } from 'lucide-react';
import type { PageProps } from '../../app/navigation/pages';
import { EmptyState } from '../../ui/EmptyState';

export function DiffPage(_props: PageProps<'diff'>) {
  return <EmptyState icon={<Construction size={22} />} title="Diff" description="This area is being built." />;
}
