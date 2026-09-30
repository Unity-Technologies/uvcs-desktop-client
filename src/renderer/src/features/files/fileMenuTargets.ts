import { canAnnotate } from '@shared/domain/annotate';
import type { TreeItem } from '@shared/domain/explorer';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { hasRevisions, isControlled } from '../pendingChanges/changeCategories';
import type { PendingChangesIndex } from './itemStatus';
import { hasRevisionType } from './itemType';
import { isWorkspaceRoot } from './workspaceRoot';

/** Which of the selected items each file menu action applies to. */
export interface FileMenuTargets {
  /** To add to version control. */
  privateItems: TreeItem[];
  /** Controlled items with nothing pending, to check out. */
  checkoutCandidates: TreeItem[];
  /** Changes to undo: private items have none, whatever the pending changes list them as. */
  undoable: PendingChange[];
  /** Files whose revision type can be changed. */
  typedFiles: TreeItem[];
}

export function fileMenuTargets(items: TreeItem[], pendingChanges: PendingChangesIndex): FileMenuTargets {
  const controlled = items.filter((item) => !item.isPrivate);
  return {
    privateItems: items.filter((item) => item.isPrivate),
    checkoutCandidates: controlled.filter((item) => !item.isCheckedOut && !pendingChanges.changeAt(item.path)),
    undoable: items.map((item) => pendingChanges.changeAt(item.path)).filter((change): change is PendingChange => change !== undefined && isControlled(change)),
    typedFiles: controlled.filter((item) => hasRevisionType(item.itemType)),
  };
}

/** Whether the item has revisions to show (history, annotations, its last change): added items get their first at checkin. */
export function hasRevisionsToShow(item: TreeItem, pendingChanges: PendingChangesIndex): boolean {
  const change = pendingChanges.changeAt(item.path);
  return change ? hasRevisions(change) : !item.isPrivate;
}

/** Where one selected item leads, for its menu, the palette's commands and its details. */
export interface ItemViews {
  history: boolean;
  /** The file annotated beside the tree, in its diff's place. */
  annotate: boolean;
  /** Back to the file's diff from its annotations: a controlled file has one. */
  changes: boolean;
}

export function itemViews(item: TreeItem, pendingChanges: PendingChangesIndex): ItemViews {
  const hasRevisions = hasRevisionsToShow(item, pendingChanges);
  return {
    // The root changes with every changeset: its history is the whole repository's.
    history: hasRevisions && !isWorkspaceRoot(item),
    annotate: hasRevisions && canAnnotate(item.itemType),
    changes: !item.isPrivate && item.itemType !== 'directory',
  };
}
