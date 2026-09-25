import { Construction } from 'lucide-react';
import type { PageProps } from '../../app/navigation/pages';
import { EmptyState } from '../../ui/EmptyState';

export function AnnotatePage(_props: PageProps<'annotate'>) {
  return <EmptyState icon={<Construction size={22} />} title="Annotate" description="This area is being built." />;
}
