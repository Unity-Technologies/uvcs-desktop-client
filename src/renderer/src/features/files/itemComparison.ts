import type { TreeItem } from '@shared/domain/explorer';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { categoryOf, existsOnDisk, isControlled } from '../pendingChanges/changeCategories';

/**
 * What Files compares for the selected file, the most telling comparison for its status:
 * - `changes`: a file with a pending change, the disk version against the loaded revision, as in Changes;
 * - `new`: a file with no revision yet (added, private, ignored), whole, against nothing;
 * - `lastChange`: an up-to-date file (or any of a repository tree), its revision against the one before it.
 */
export type ItemComparison =
  | { kind: 'changes'; change: PendingChange }
  | { kind: 'new'; reason: 'added' | 'private' | 'ignored'; change?: PendingChange }
  | { kind: 'lastChange' };

type ComparedItem = Pick<TreeItem, 'itemType' | 'isPrivate' | 'revisionId'>;

/** Null for a folder, or a file with nothing to compare (a revision `cm ls` didn't list). */
export function itemComparison(item: ComparedItem, change: PendingChange | undefined, inWorkspace: boolean): ItemComparison | null {
  if (item.itemType === 'directory') return null;
  if (inWorkspace && change) {
    if (!isControlled(change)) return { kind: 'new', reason: categoryOf(change) === 'private' ? 'private' : 'ignored' };
    return change.kinds.includes('added') ? { kind: 'new', reason: 'added', change } : { kind: 'changes', change };
  }
  if (inWorkspace && item.isPrivate) return { kind: 'new', reason: 'private' };
  return item.revisionId > 0 ? { kind: 'lastChange' } : null;
}

/**
 * Whether "Diff | Annotate" offers Annotate: `cm annotate` reads revisions, so a file with none yet has no annotations, and
 * one deleted from disk has no text to annotate as it is now.
 */
export function canAnnotateComparison(comparison: ItemComparison | null): boolean {
  if (!comparison || comparison.kind === 'new') return false;
  return comparison.kind === 'lastChange' || existsOnDisk(comparison.change);
}
