import { EyeClosed, EyeOff, FileClock } from 'lucide-react';
import { canAnnotate } from '@shared/domain/annotate';
import type { Changelist, FilterRuleList, PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { annotatedHistory } from '../history/annotatedHistory';
import { tidyMenu, type MenuEntry } from '../../lib/actions';
import { groupedMenu, type GroupedEntry } from '../../lib/menuGroups';
import { copySubmenu } from '../../components/copyMenu';
import { menuAction, menuSubmenu } from '../../components/menuWords';
import { TRASH_NAME } from '../../lib/platform';
import { formatCount } from '../../lib/text';
import { categoryOf, existsOnDisk, hasRevisions, isCheckinCandidate, isControlled } from './changeCategories';
import { moveToChangelistSubmenu } from './changelistMenu';
import { reviewMenuEntry } from '../review/reviewMenuEntry';
import type { ListReview } from '../review/useReviewMode';
import {
  absolutePath,
  addFilterRule,
  addToSourceControl,
  checkout,
  deletePrivateFiles,
  extensionOf,
  FILTER_LIST_FILES,
  openWithDefaultApp,
  undoChanges,
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
): MenuEntry[] {
  if (changes.length === 0) return [];

  const single = changes.length === 1 ? changes[0]! : null;
  const privateChanges = changes.filter((change) => categoryOf(change) === 'private');
  const controlledChanges = changes.filter(isControlled);
  const checkoutCandidates = controlledChanges.filter((change) => !change.kinds.includes('checkedOut') && !change.kinds.includes('added'));
  const onDisk = single && existsOnDisk(single);

  return groupedMenu([
    onDisk && menuAction('open', () => openWithDefaultApp(workspacePath, single)),
    ...(inclusion ? inclusionEntries(changes, inclusion) : []),
    review && reviewMenuEntry(changes, review),
    privateChanges.length > 0 &&
      menuAction('add', () => void addToSourceControl(workspacePath, privateChanges), {
        label: privateChanges.length === 1 ? 'Add to version control' : `Add ${formatCount(privateChanges.length)} items to version control`,
      }),
    checkoutCandidates.length > 0 && menuAction('checkout', () => void checkout(workspacePath, checkoutCandidates)),
    single && hasRevisions(single) && menuAction('history', () => navigation.openPage({ kind: 'history', path: single.path })),
    single &&
      hasRevisions(single) &&
      canAnnotate(single.itemType) &&
      menuAction('annotate', () => navigation.openPage(annotatedHistory({ path: single.path }))),
    onDisk && menuAction('reveal', () => void api.system.revealInFileManager(absolutePath(workspacePath, single.path))),
    itemCopySubmenu(workspacePath, changes.map((change) => change.path)),
    moveToChangelistSubmenu(workspacePath, changes, changelists),
    single && filterRulesSubmenu(workspacePath, single.path),
    controlledChanges.length > 0 &&
      menuAction('undo', () => void undoChanges(workspacePath, controlledChanges), {
        label: controlledChanges.length === 1 ? 'Undo changes…' : `Undo ${formatCount(controlledChanges.length)} changes…`,
      }),
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

/** The "Copy" submenu of workspace items: their paths, relative to the workspace or full. */
export function itemCopySubmenu(workspacePath: string, paths: string[]): GroupedEntry | null {
  return copySubmenu('', { path: paths.join('\n'), fullPath: paths.map((path) => absolutePath(workspacePath, path)).join('\n') }, { count: paths.length });
}

/** Adds an item, or all files with its extension, to the ignore, cloaked or hidden-changes rules. */
export function filterRulesSubmenu(workspacePath: string, path: string): GroupedEntry {
  const extension = extensionOf(path);
  const patternsFor = (list: FilterRuleList): MenuEntry[] =>
    tidyMenu([
      { id: `${list}.path`, label: `This item (/${path})`, run: () => void addFilterRule(workspacePath, list, `/${path}`) },
      extension !== null && { id: `${list}.extension`, label: `All ${extension} files`, run: () => void addFilterRule(workspacePath, list, `*${extension}`) },
    ]);

  return menuSubmenu('filterRules', [
    { label: `Add to ${FILTER_LIST_FILES.ignore}`, icon: EyeOff, entries: patternsFor('ignore') },
    { label: `Add to ${FILTER_LIST_FILES.cloaked}`, icon: FileClock, entries: patternsFor('cloaked') },
    { label: `Add to ${FILTER_LIST_FILES.hidden}`, icon: EyeClosed, entries: patternsFor('hidden') },
  ]);
}
