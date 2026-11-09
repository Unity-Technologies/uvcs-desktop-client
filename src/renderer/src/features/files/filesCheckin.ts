import type { TreeItem } from '@shared/domain/explorer';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { parentOf } from '../../lib/paths';
import { indexPending, neededWith } from '../pendingChanges/checkinDependencies';
import { isCheckinCandidate, isControlled } from '../pendingChanges/changeCategories';

/** Which selected folders a pending change sits in: a private one takes its private items, a controlled one doesn't. */
interface InsideSelected {
  privateFolder: boolean;
  controlledFolder: boolean;
}

const OUTSIDE: InsideSelected = { privateFolder: false, controlledFolder: false };

/**
 * The pending changes a check-in of the items selected in Files takes: each item's own change (a private item the
 * Changes filter hides still goes in: it is added), the changes inside each selected folder (the root's, every one),
 * and what those need to go in (`neededWith`: the new folder above a new file, the rest of a merge). A controlled
 * folder takes only its controlled changes, as Add takes a new file, one by one; a private folder takes all it holds,
 * since it is added whole. Ignored, cloaked and hidden changes never go in.
 */
export function filesCheckinChanges(items: TreeItem[], pending: PendingChange[]): PendingChange[] {
  const byPath = new Map(pending.map((change) => [change.path, change]));
  const unlisted = items.filter((item) => item.isPrivate && !byPath.has(item.path)).map(unlistedPrivateChange);
  for (const change of unlisted) byPath.set(change.path, change);
  const all = unlisted.length === 0 ? pending : [...pending, ...unlisted];
  const own = items.map((item) => byPath.get(item.path));
  const insideOf = insideSelectedFolders(items);
  const inside = all.filter((change) => {
    const { privateFolder, controlledFolder } = insideOf(parentOf(change.path));
    return privateFolder || (controlledFolder && isControlled(change));
  });
  const selected = new Map<string, PendingChange>();
  for (const change of [...own, ...inside]) if (change && isCheckinCandidate(change)) selected.set(change.path, change);
  return neededWith([...selected.values()], indexPending(all));
}

/** Whether a folder is, or is inside, a selected private or controlled folder: worked out once per folder. */
function insideSelectedFolders(items: TreeItem[]): (folder: string) => InsideSelected {
  const selectedFolders = new Map(items.filter(isFolderItem).map((item) => [item.path, item.isPrivate]));
  const known = new Map<string, InsideSelected>();
  const insideOf = (folder: string): InsideSelected => {
    const found = known.get(folder);
    if (found) return found;
    const above = folder === '' ? OUTSIDE : insideOf(parentOf(folder));
    const isPrivate = selectedFolders.get(folder);
    const answer =
      isPrivate === undefined
        ? above
        : { privateFolder: above.privateFolder || isPrivate, controlledFolder: above.controlledFolder || !isPrivate };
    known.set(folder, answer);
    return answer;
  };
  return insideOf;
}

function isFolderItem(item: TreeItem): boolean {
  return item.itemType === 'directory' || item.itemType === 'xlink';
}

/** A private item the pending changes don't list, because the Changes filter hides private items. */
function unlistedPrivateChange(item: TreeItem): PendingChange {
  return { path: item.path, kinds: ['private'], itemType: item.itemType, size: item.size, lastModified: item.date };
}
