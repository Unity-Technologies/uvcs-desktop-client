import { useMemo, useRef } from 'react';
import { rankList, type FileListFacts, type ListRanking, type RankedOrder } from './fileListOrder';
import { useFileListViewStore } from './fileListViewStore';

/**
 * The order of a list of changed files for the sort chosen (`useFileListViewStore`), `listed`, every item of the list
 * before the filter, ranked once a read (`rankedOrder`): typing in the filter then picks what it leaves out of the
 * ranks, never comparing names again, which for 50,000 files of a diff sorted by name took 100 ms a key. A read after
 * files changed starts from the last ranking of the same sort (`rankList`). `facts` stable. Undefined for the path
 * order the items already have.
 */
export function useRankedOrder<T extends { path: string }>(listed: readonly T[], facts: FileListFacts<T>): RankedOrder<T> | undefined {
  const sort = useFileListViewStore((state) => state.sort);
  const last = useRef<ListRanking<T> | undefined>(undefined);
  return useMemo(() => {
    last.current = rankList(listed, sort, facts, last.current);
    return last.current.order;
  }, [listed, sort, facts]);
}
