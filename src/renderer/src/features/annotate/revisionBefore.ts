import type { ItemRevision } from '@shared/domain/history';

/**
 * The revision of the file just before `changesetId` changed it, to annotate "before this change".
 * `revisions` is the item history, newest first.
 */
export function revisionBefore(revisions: readonly ItemRevision[], changesetId: number): ItemRevision | undefined {
  return revisions.find((revision) => revision.changesetId < changesetId);
}
