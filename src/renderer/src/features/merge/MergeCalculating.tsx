import type { MergeRequest } from '@shared/domain/merge';
import { ListToolbar } from '../../components/ListToolbar';
import { useChangeFilter } from '../../components/useChangeFilter';
import { ListSkeleton } from '../../ui/Skeleton';
import { mergeLabels } from './mergeDescription';
import { MergeHeader } from './MergeHeader';
import { mergeItemTones, type MergeItem } from './mergeItems';
import { MergePanes } from './MergePanes';

const NO_ITEMS: MergeItem[] = [];
const itemPath = (item: MergeItem): string => item.path;
const nothing = (): void => {};

/**
 * The merge page while its plan is calculated, which can take seconds: its header, filter bar and panes as they will
 * be, the button disabled and placeholder rows where the items go.
 */
export function MergeCalculating({ request }: { request: MergeRequest }) {
  const filter = useChangeFilter(NO_ITEMS, itemPath, mergeItemTones, { isViewFilter: true, reading: true });
  return (
    <MergePanes
      header={
        <MergeHeader
          request={request}
          plan={undefined}
          labels={mergeLabels(request, undefined)}
          progress="Calculating the merge…"
          summary=""
          intoServerBranch={Boolean(request.destinationBranch)}
          comment=""
          onCommentChange={nothing}
          canMerge={false}
          merging={false}
          onMerge={nothing}
        />
      }
      list={
        <>
          <ListToolbar>{filter.bar}</ListToolbar>
          <ListSkeleton rowHeight={28} />
        </>
      }
      detail={null}
    />
  );
}
