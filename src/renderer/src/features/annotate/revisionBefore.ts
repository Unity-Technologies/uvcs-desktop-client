import type { ItemRevision } from '@shared/domain/history';
import { parentRevision } from '../history/parentRevision';

/**
 * The revision of the file just before `changesetId` changed it, to annotate "before this change": the parent of the
 * revision that changeset made, or for a changeset the history doesn't list (a merge's lines), the one before it.
 * `revisions` is the item history, newest first.
 */
export function revisionBefore(revisions: readonly ItemRevision[], changesetId: number): ItemRevision | undefined {
  const changed = revisions.find((revision) => revision.changesetId === changesetId);
  return changed ? parentRevision(revisions, changed) : revisions.find((revision) => revision.changesetId < changesetId);
}
