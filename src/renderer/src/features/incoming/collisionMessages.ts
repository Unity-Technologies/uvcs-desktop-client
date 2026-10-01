import { branchLabel } from '../../lib/branchLabels';
import { pluralize } from '../../lib/text';

/** "2 files you changed were", "A file you changed was". */
function filesYouChanged(count: number): string {
  return count === 1 ? 'A file you changed was' : `${count} files you changed were`;
}

/** The update bar while local changes to files the branch deleted or moved block the update. */
export function blockedMessage(blockedCount: number, branch: string, pendingMergeCount: number): string {
  const blocked = `${filesYouChanged(blockedCount)} deleted or moved on ${branchLabel(branch)}.`;
  return pendingMergeCount > 0 ? `${blocked} ${pluralize(pendingMergeCount, 'other needs', 'others need')} merging.` : blocked;
}

/** The update bar otherwise: what updating does, or which merges it waits for. */
export function updateBarMessage(changesetCount: number, branch: string, mergeCount: number, pendingMergeCount: number): string {
  if (mergeCount === 0) return `Update to get ${pluralize(changesetCount, 'new changeset')}. Your local changes stay as they are.`;
  if (pendingMergeCount === mergeCount) {
    return mergeCount === 1
      ? `A file you changed also changed on ${branchLabel(branch)}. Merge it to update.`
      : `${mergeCount} files you changed also changed on ${branchLabel(branch)}. Merge them to update.`;
  }
  if (pendingMergeCount > 0) return `${pendingMergeCount} of ${mergeCount} files changed on both sides still ${pendingMergeCount === 1 ? 'needs' : 'need'} merging.`;
  return mergeCount === 1 ? 'The file is merged. Update to apply it.' : `All ${mergeCount} files are merged. Update to apply them.`;
}

/** The incoming card's note on local changes the new changesets collide with, and where to sort them out. */
export function collisionNote(mergeCount: number, blockedCount: number): string {
  const count = mergeCount + blockedCount;
  const them = count === 1 ? 'it' : 'them';
  if (blockedCount === 0) return `${filesYouChanged(count)} also changed there. Merge ${them} in Incoming to update.`;
  if (mergeCount === 0) return `${filesYouChanged(count)} deleted or moved there. Shelve ${them} in Incoming to update.`;
  return `${filesYouChanged(count)} also changed, deleted or moved there. Sort ${them} out in Incoming to update.`;
}
