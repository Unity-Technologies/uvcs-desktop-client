import { useMemo, useRef } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { fileListOrder, rankedOrder, type RankedOrder } from '../../components/fileListOrder';
import type { FileListSort } from '../../components/fileListViewStore';
import { PENDING_CHANGE_FACTS } from './changeTone';

/**
 * The order of the Changes list for `sort`, the changes ranked once a read (`rankedOrder`): typing in the filter then
 * picks what it leaves out of the ranks, never comparing names again. A read after files changed starts from the last
 * ranking, as `useSortedChanges` does from the last path order. Undefined for the path order the changes already have.
 */
export function useChangeOrder(sorted: PendingChange[], sort: FileListSort): RankedOrder<PendingChange> | undefined {
  const last = useRef<RankedOrder<PendingChange> | undefined>(undefined);
  return useMemo(() => {
    const order = fileListOrder(sort, PENDING_CHANGE_FACTS);
    const ranked = order && rankedOrder(sorted, order, last.current);
    last.current = ranked;
    return ranked;
  }, [sorted, sort]);
}
