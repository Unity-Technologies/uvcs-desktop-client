import { useMemo, useRef } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { inPreviousOrder, sortChanges } from './changeOrder';

/**
 * The changes in the order the rows show them. A read after files changed keeps most changes as they were, so they
 * start from the order last worked out: sorting 100,000 changes again goes through them about once instead of 17 times.
 */
export function useSortedChanges(changes: PendingChange[]): PendingChange[] {
  const last = useRef<PendingChange[] | null>(null);
  return useMemo(() => {
    const sorted = sortChanges(last.current ? inPreviousOrder(changes, last.current) : changes);
    last.current = sorted;
    return sorted;
  }, [changes]);
}
