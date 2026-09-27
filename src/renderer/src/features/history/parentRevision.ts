import type { ItemRevision } from '@shared/domain/history';

/**
 * The revision `revision` was made from, which is what it changed: with branches, the revision listed below it is often
 * another branch's. Falls back to that one when the parent isn't listed; none for the revision that added the item.
 * `revisions` is the item history, newest first.
 */
export function parentRevision(revisions: readonly ItemRevision[], revision: ItemRevision): ItemRevision | undefined {
  if (revision.parentRevisionId < 0) return undefined;
  return (
    revisions.find((candidate) => candidate.revisionId === revision.parentRevisionId) ??
    revisions.find((candidate) => candidate.changesetId < revision.changesetId)
  );
}
