import { MousePointerClick } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

/** The details panel while nothing is selected; `noun` names what to select, e.g. "branch". */
export function NoSelection({ noun }: { noun: string }) {
  return <EmptyState icon={<MousePointerClick size={22} />} title="Nothing selected" description={`Select a ${noun} to see its details.`} />;
}
