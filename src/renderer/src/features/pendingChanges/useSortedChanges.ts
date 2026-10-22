import { useMemo } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { sortChanges } from './changeOrder';

/** The changes in the order the rows show them, sorted again only when a read brings others. */
export function useSortedChanges(changes: PendingChange[]): PendingChange[] {
  return useMemo(() => sortChanges(changes), [changes]);
}
