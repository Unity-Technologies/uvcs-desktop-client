import type { ItemType } from './pendingChanges';

/** One revision of a file or directory, as listed by its history. */
export interface ItemRevision {
  revisionId: number;
  changesetId: number;
  branch: string;
  owner: string;
  date: string;
  /** Comment of the changeset that created the revision. */
  comment: string;
  itemType: ItemType;
  size: number;
  /** Spec to load this revision, e.g. `src/app.ts#cs:12`. */
  spec: string;
}
