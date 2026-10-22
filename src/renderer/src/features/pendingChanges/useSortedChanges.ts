import { useMemo, useRef } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { sortChanges, sortedFromPrevious } from './changeOrder';

/**
 * The changes in the order the rows show them. A read after files changed keeps most changes as they were, so they
 * start from the order last worked out (`sortedFromPrevious`): only the changes that differ are sorted.
 */
export function useSortedChanges(changes: PendingChange[]): PendingChange[] {
  const last = useRef<PendingChange[] | null>(null);
  return useMemo(() => {
    const sorted = last.current ? sortedFromPrevious(changes, last.current) : sortChanges(changes);
    last.current = sorted;
    return sorted;
  }, [changes]);
}
