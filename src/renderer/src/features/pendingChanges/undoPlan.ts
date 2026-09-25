import type { PendingChange } from '@shared/domain/pendingChanges';
import { categoryOf, hasContentChanges } from './changeCategories';

/** Rows listed in the undo confirmation before collapsing the rest into "…and N more". */
export const UNDO_LIST_MAX = 250;

/** Undoing more changes than this suggests shelving a backup first, even without edits to lose. */
const BACKUP_SUGGESTED_ABOVE = 10;

export const BACKUP_SHELVE_COMMENT = 'Backup before undo';

/** Whether undoing edits text the user wrote: those are the edits worth keeping a backup of. */
function losesTextEdits(change: PendingChange): boolean {
  return change.itemType === 'file' && hasContentChanges(change) && categoryOf(change) !== 'added';
}

/** Whether the "Shelve a backup first" box starts ticked. */
export function suggestsBackup(changes: PendingChange[]): boolean {
  return changes.length > BACKUP_SUGGESTED_ABOVE || changes.some(losesTextEdits);
}

/** One sentence per kind of change about what undoing it does to the workspace. */
export function undoConsequences(changes: PendingChange[]): string[] {
  const count = (matches: (change: PendingChange) => boolean): number => changes.filter(matches).length;
  const added = count((change) => categoryOf(change) === 'added');
  const deleted = count((change) => categoryOf(change) === 'deleted');
  const moved = count((change) => categoryOf(change) === 'moved');
  const edited = count((change) => hasContentChanges(change) && categoryOf(change) !== 'added');
  const unchangedCheckouts = count((change) => categoryOf(change) === 'changed' && !hasContentChanges(change));

  return [
    edited > 0 && (edited === 1 ? 'Local edits to 1 file are lost.' : `Local edits to ${edited} files are lost.`),
    added > 0 &&
      (added === 1
        ? '1 added item becomes a private file and stays on disk.'
        : `${added} added items become private files and stay on disk.`),
    moved > 0 && (moved === 1 ? '1 moved item goes back to its old path.' : `${moved} moved items go back to their old paths.`),
    deleted > 0 && (deleted === 1 ? '1 deleted item is restored.' : `${deleted} deleted items are restored.`),
    unchangedCheckouts > 0 &&
      (unchangedCheckouts === 1 ? '1 checkout without edits is released.' : `${unchangedCheckouts} checkouts without edits are released.`),
  ].filter((line): line is string => typeof line === 'string');
}
