import { EyeClosed, EyeOff, FileClock } from 'lucide-react';
import { canAnnotate } from '@shared/domain/annotate';
import type { Changelist, FilterRuleList, PendingChange } from '@shared/domain/pendingChanges';
import { navigation } from '../../app/navigation/navigationStore';
import { annotatedHistory } from '../history/annotatedHistory';
import { tidyMenu, type MenuEntry } from '../../lib/actions';
import { groupedMenu, type GroupedEntry } from '../../lib/menuGroups';
import { copySubmenu, type CopyTexts } from '../../components/copyMenu';
import { hotkey } from '../../lib/shortcutRegistry';
import { openOnDiskEntries } from '../../components/externalApps/openWithMenu';
import { menuAction, menuSubmenu } from '../../components/menuWords';
import { TRASH_NAME } from '../../lib/platform';
import { formatCount } from '../../lib/text';
import { categoryOf, existsOnDisk, hasRevisions, isCheckinCandidate, isControlled } from './changeCategories';
import { moveToChangelistSubmenu } from './changelistMenu';
import { matchSideOf } from './moveMatches';
import { itemRulePatterns, sharedExtension } from './filterRulePatterns';
import { showInLocks } from '../locks/showInLocks';
import type { PendingLocks } from './locks/pendingLocks';
import { reviewMenuEntry } from '../review/reviewMenuEntry';
import type { ListReview } from '../review/useReviewMode';
import {
  absolutePath,
  addFilterRules,
  addToSourceControl,
  checkout,
  deletePrivateFiles,
  FILTER_LIST_FILES,
  searchMatches,
  undoChanges,
  undoChangesLabel,
} from './pendingChangeOperations';

/** Whether each change goes into the next check-in, and a way to change it. */
interface CheckinInclusion {
  isIncluded: (change: PendingChange) => boolean;
  setIncluded: (changes: PendingChange[], included: boolean) => void;
}

/** The context menu for the selected pending changes. */
export function pendingChangeMenu(
  workspacePath: string,
  changes: PendingChange[],
  changelists: Changelist[],
  /** Offers to include or exclude the changes; left out where there is no check-in to pick for (the command palette). */
  inclusion?: CheckinInclusion,
  /** Offers to mark the changes reviewed or clear their marks; left out where there are no marks (the command palette). */
  review?: ListReview<PendingChange>,
  /** Offers to show a locked change's lock; left out where the locks aren't read (the command palette). */
  locks?: PendingLocks,
  /** Every change listed, which Search matches pairs one with; left out where they aren't at hand (the command palette). */
  listed?: readonly PendingChange[],
): MenuEntry[] {
  if (changes.length === 0) return [];

  const single = changes.length === 1 ? changes[0]! : null;
  const lock = single ? locks?.get(single.path) : undefined;
  const privateChanges = changes.filter((change) => categoryOf(change) === 'private');
  const controlledChanges = changes.filter(isControlled);
  const checkoutCandidates = controlledChanges.filter((change) => !change.kinds.includes('checkedOut') && !change.kinds.includes('added'));
  const onDisk = single && existsOnDisk(single);
  const matchSide = single && listed ? matchSideOf(single, listed) : null;

  return groupedMenu([
    ...(inclusion ? inclusionEntries(changes, inclusion) : []),
    review && reviewMenuEntry(changes, review),
    privateChanges.length > 0 &&
      menuAction('add', () => void addToSourceControl(workspacePath, privateChanges), {
        label: privateChanges.length === 1 ? 'Add to version control' : `Add ${formatCount(privateChanges.length)} items to version control`,
      }),
    checkoutCandidates.length > 0 && menuAction('checkout', () => void checkout(workspacePath, checkoutCandidates)),
    single && matchSide && menuAction('searchMatches', () => void searchMatches(workspacePath, single, matchSide)),
    single && hasRevisions(single) && menuAction('history', () => navigation.openPage({ kind: 'history', path: single.path })),
    single &&
      hasRevisions(single) &&
      canAnnotate(single.itemType) &&
      menuAction('annotate', () => navigation.openPage(annotatedHistory({ path: single.path }))),
    lock && menuAction('showInLocks', () => showInLocks(workspacePath, lock)),
    ...(onDisk ? openOnDiskEntries({ path: absolutePath(workspacePath, single.path), isFolder: single.itemType === 'directory' }) : []),
    itemCopySubmenu(workspacePath, changes.map((change) => change.path)),
    moveToChangelistSubmenu(workspacePath, changes, changelists),
    filterRulesSubmenu(workspacePath, changes.map((change) => change.path)),
    controlledChanges.length > 0 &&
      menuAction('undo', () => void undoChanges(workspacePath, controlledChanges), { label: undoChangesLabel(controlledChanges.length) }),
    privateChanges.length > 0 && menuAction('trash', () => void deletePrivateFiles(workspacePath, privateChanges), { label: `Move to ${TRASH_NAME}…` }),
  ]);
}

/** Include the unchecked changes in the next check-in, or exclude the checked ones. */
function inclusionEntries(changes: PendingChange[], { isIncluded, setIncluded }: CheckinInclusion): GroupedEntry[] {
  const candidates = changes.filter(isCheckinCandidate);
  const excluded = candidates.filter((change) => !isIncluded(change));
  const included = candidates.filter(isIncluded);
  return [
    ...(excluded.length > 0 ? [menuAction('include', () => setIncluded(excluded, true))] : []),
    ...(included.length > 0 ? [menuAction('exclude', () => setIncluded(included, false))] : []),
  ];
}

/**
 * The "Copy" submenu of workspace items: their paths, relative to the workspace or full. One item's show beside their
 * labels; several are joined only when copied, since a right-click can hold 50,000 of them.
 */
export function itemCopySubmenu(workspacePath: string, paths: string[], link?: CopyTexts['link']): GroupedEntry | null {
  const relative = (): string => paths.join('\n');
  const full = (): string => paths.map((path) => absolutePath(workspacePath, path)).join('\n');
  if (paths.length === 0) return null;
  if (paths.length === 1) return copySubmenu('', { path: relative(), fullPath: full(), link }, { linkShortcut: link ? hotkey('copyLink') : undefined });
  return copySubmenu('', { path: async () => relative(), fullPath: async () => full() }, { count: paths.length });
}

/** Adds the selected items, or all files with the extension they share, to the ignore, cloaked or hidden-changes rules. */
export function filterRulesSubmenu(workspacePath: string, paths: string[]): GroupedEntry {
  const itemPatterns = itemRulePatterns(paths);
  const extension = sharedExtension(paths);
  const itemsLabel = itemPatterns.length === 1 ? `This item (${itemPatterns[0]})` : `These ${formatCount(itemPatterns.length)} items`;
  const patternsFor = (list: FilterRuleList): MenuEntry[] =>
    tidyMenu([
      { id: `${list}.path`, label: itemsLabel, run: () => void addFilterRules(workspacePath, list, itemPatterns) },
      extension !== null && { id: `${list}.extension`, label: `All ${extension} files`, run: () => void addFilterRules(workspacePath, list, [`*${extension}`]) },
    ]);

  return menuSubmenu('filterRules', [
    { label: `Add to ${FILTER_LIST_FILES.ignore}`, icon: EyeOff, entries: patternsFor('ignore') },
    { label: `Add to ${FILTER_LIST_FILES.cloaked}`, icon: FileClock, entries: patternsFor('cloaked') },
    { label: `Add to ${FILTER_LIST_FILES.hidden}`, icon: EyeClosed, entries: patternsFor('hidden') },
  ]);
}
