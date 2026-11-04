import { useMemo, useRef } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { rankList, type ListRanking, type RankedOrder } from '../../components/fileListOrder';
import type { FileListSort } from '../../components/fileListViewStore';
import { PENDING_CHANGE_FACTS } from './changeTone';

/**
 * The order of the Changes list for `sort`, the changes ranked once a read (`rankedOrder`): typing in the filter then
 * picks what it leaves out of the ranks, never comparing names again. A read after files changed starts from the last
 * ranking of the same sort (`rankList`), as `useSortedChanges` does from the last path order. Undefined for the path
 * order the changes already have.
 */
export function useChangeOrder(sorted: PendingChange[], sort: FileListSort): RankedOrder<PendingChange> | undefined {
  const last = useRef<ListRanking<PendingChange> | undefined>(undefined);
  return useMemo(() => {
    last.current = rankList(sorted, sort, PENDING_CHANGE_FACTS, last.current);
    return last.current.order;
  }, [sorted, sort]);
}
