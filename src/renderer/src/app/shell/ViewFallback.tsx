import type { ViewDefinition } from '../navigation/viewRegistry';
import { ListSkeleton } from '../../ui/ListSkeleton';
import { ViewHeader } from '../../ui/ViewHeader';

/** What a view shows while its code loads on the first visit: its header and placeholder rows, never a blank area. */
export function ViewFallback({ view }: { view: Pick<ViewDefinition, 'label'> }) {
  return (
    <>
      <ViewHeader title={view.label} />
      <ListSkeleton />
    </>
  );
}
