import type { PendingChange } from '@shared/domain/pendingChanges';
import { isControlled } from './changeCategories';

/** The changes that would actually move into `changelist` (null: the default one): controlled ones not already in it. */
export function changesToMove(changes: PendingChange[], changelist: string | null): PendingChange[] {
  return changes.filter((change) => isControlled(change) && (change.changelist ?? null) !== changelist);
}
