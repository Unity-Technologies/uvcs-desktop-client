import { Construction } from 'lucide-react';
import type { PageProps } from '../../app/navigation/pages';
import { EmptyState } from '../../ui/EmptyState';

export function HistoryPage(_props: PageProps<'history'>) {
  return <EmptyState icon={<Construction size={22} />} title="History" description="This area is being built." />;
}
