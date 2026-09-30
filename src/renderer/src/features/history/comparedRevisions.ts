import type { ItemRevision } from '@shared/domain/history';
import { parentRevision } from './parentRevision';

/**
 * The revisions the history's pane compares, newer first: two selected revisions with each other (the newest two of
 * them), one with the revision it was made from (`parentRevision`; none for the one that added the file). None
 * selected, none compared. `revisions` is the item history, newest first.
 */
export function comparedRevisions(revisions: readonly ItemRevision[], selected: readonly ItemRevision[]): [ItemRevision | undefined, ItemRevision | undefined] {
  if (selected.length >= 2) {
    const [newer, older] = [...selected].sort((a, b) => b.changesetId - a.changesetId);
    return [newer, older];
  }
  const newer = selected[0];
  if (!newer) return [undefined, undefined];
  return [newer, parentRevision(revisions, newer)];
}
