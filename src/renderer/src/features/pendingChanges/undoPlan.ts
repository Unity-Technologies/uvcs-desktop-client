import type { PendingChange } from '@shared/domain/pendingChanges';
import { formatCount } from '../../lib/text';
import { categoryOf, hasContentChanges, isShelvable } from './changeCategories';

/** Rows listed in the undo confirmation before collapsing the rest into "…and N more". */
export const UNDO_LIST_MAX = 250;

export const BACKUP_SHELVE_COMMENT = 'Backup before undo';

/** A checkout without edits: undoing it only releases the file. */
function isUnchangedCheckout(change: PendingChange): boolean {
  return categoryOf(change) === 'changed' && !hasContentChanges(change);
}

/** Whether a backup could keep anything: releasing checkouts without edits leaves nothing to shelve, and links can't be. */
export function offersBackup(changes: PendingChange[]): boolean {
  return changes.some((change) => isShelvable(change) && !isUnchangedCheckout(change));
}

/** One sentence per kind of change about what undoing it does to the workspace. */
export function undoConsequences(changes: PendingChange[]): string[] {
  const count = (matches: (change: PendingChange) => boolean): number => changes.filter(matches).length;
  const added = count((change) => categoryOf(change) === 'added');
  const deleted = count((change) => categoryOf(change) === 'deleted');
  const moved = count((change) => categoryOf(change) === 'moved');
  const edited = count((change) => hasContentChanges(change) && categoryOf(change) !== 'added');
  const unchangedCheckouts = count(isUnchangedCheckout);

  return [
    edited > 0 && (edited === 1 ? 'Local edits to 1 file are lost.' : `Local edits to ${formatCount(edited)} files are lost.`),
    added > 0 &&
      (added === 1
        ? '1 added item becomes a private file and stays on disk.'
        : `${formatCount(added)} added items become private files and stay on disk.`),
    moved > 0 && (moved === 1 ? '1 moved item goes back to its old path.' : `${formatCount(moved)} moved items go back to their old paths.`),
    deleted > 0 && (deleted === 1 ? '1 deleted item is restored.' : `${formatCount(deleted)} deleted items are restored.`),
    unchangedCheckouts > 0 &&
      (unchangedCheckouts === 1 ? '1 checkout without edits is released.' : `${formatCount(unchangedCheckouts)} checkouts without edits are released.`),
  ].filter((line): line is string => typeof line === 'string');
}
