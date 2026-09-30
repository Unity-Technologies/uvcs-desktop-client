import type { ItemRevision } from '@shared/domain/history';

/** Where a block of annotated lines leads: its changeset, its revision in the file's history, the file before it. */
export interface BlockLinks {
  /** None for a file of another repository than the workspace's (under an xlink): no diff of the workspace's has its changesets. */
  openChangeset?: (changesetId: number) => void;
  /** The changeset's revision in the file's history: selected beside it, or opened there. */
  showInHistory: (changesetId: number) => void;
  /** Where the annotation sits beside the history list, a block's changeset number (or Enter) selects its revision there. */
  selectsInHistory: boolean;
  /** Beside the history list: "Annotate before this change", to the revision before it (if the history has one). */
  walkBack?: {
    revisionBefore: (changesetId: number) => ItemRevision | undefined;
    annotateBefore: (revision: ItemRevision) => void;
  };
}
