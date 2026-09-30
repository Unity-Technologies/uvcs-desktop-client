import { useMemo, useRef } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { inPreviousOrder, sortForLayout } from './changeOrder';
import type { ChangesLayout } from './changeRows';

/**
 * The changes in the order the layout shows them. A read after files changed keeps most changes as they were, so they
 * start from the order last worked out: sorting 100,000 changes again goes through them about once instead of 17 times.
 */
export function useSortedChanges(changes: PendingChange[], layout: ChangesLayout): PendingChange[] {
  const last = useRef<{ layout: ChangesLayout; sorted: PendingChange[] } | null>(null);
  return useMemo(() => {
    const previous = last.current?.layout === layout ? last.current.sorted : null;
    const sorted = sortForLayout(previous ? inPreviousOrder(changes, previous) : changes, layout);
    last.current = { layout, sorted };
    return sorted;
  }, [changes, layout]);
}
