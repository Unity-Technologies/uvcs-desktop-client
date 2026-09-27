import type { TreeItem } from '@shared/domain/explorer';
import type { ItemRevision } from '@shared/domain/history';
import { spec } from '@shared/domain/specs';

/**
 * The revision a tree lists for an item, as a file's history names it: annotated by its id in its repository
 * (`revid:45@game@local`; `cm annotate` finds no bare id on a cloud server), a pinned spec whose annotations are read
 * once. Its comment is the changeset's, which the listing doesn't carry.
 */
export function itemRevision(item: TreeItem, repository: string | undefined): ItemRevision {
  return {
    revisionId: item.revisionId,
    parentRevisionId: item.parentRevisionId,
    changesetId: item.changeset,
    branch: item.branch,
    owner: item.owner,
    date: item.date,
    comment: '',
    itemType: item.itemType,
    size: item.size,
    spec: `${item.path}#cs:${item.changeset}`,
    idSpec: spec.revision(item.revisionId, repository),
  };
}
