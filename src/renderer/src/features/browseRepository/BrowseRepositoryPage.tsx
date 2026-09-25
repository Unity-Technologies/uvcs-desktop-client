import { Construction } from 'lucide-react';
import type { PageProps } from '../../app/navigation/pages';
import { EmptyState } from '../../ui/EmptyState';

export function BrowseRepositoryPage(_props: PageProps<'browseRepository'>) {
  return <EmptyState icon={<Construction size={22} />} title="Browse repository" description="This area is being built." />;
}
