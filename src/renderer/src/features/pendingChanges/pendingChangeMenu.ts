import {
  AppWindow,
  Copy,
  EyeOff,
  FileClock,
  FolderSearch,
  History,
  PenLine,
  Plus,
  ScanText,
  Square,
  SquareCheckBig,
  Trash2,
  Undo2,
} from 'lucide-react';
import { canAnnotate } from '@shared/domain/annotate';
import type { Changelist, FilterRuleList, PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { SEPARATOR, tidyMenu, type MenuEntry, type Submenu } from '../../lib/actions';
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
  copyPaths,
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

  return tidyMenu([
    ...(inclusion ? inclusionEntries(changes, inclusion) : []),
    review && reviewMenuEntry(changes, review),
    SEPARATOR,
    onDisk && {
      id: 'open',
      label: 'Open',
      icon: AppWindow,
      run: () => openWithDefaultApp(workspacePath, single),
    },
    onDisk && {
      id: 'reveal',
      label: 'Reveal in file manager',
      icon: FolderSearch,
      run: () => void api.system.revealInFileManager(absolutePath(workspacePath, single.path)),
    },
    SEPARATOR,
    single && hasRevisions(single) && {
      id: 'history',
      label: 'View history',
      icon: History,
      run: () => navigation.openPage({ kind: 'history', path: single.path }),
    },
    single && hasRevisions(single) && canAnnotate(single.itemType) && {
      id: 'annotate',
      label: 'Annotate',
      icon: ScanText,
      run: () => navigation.openPage({ kind: 'annotate', path: single.path }),
    },
    SEPARATOR,
    privateChanges.length > 0 && {
      id: 'add',
      label: privateChanges.length === 1 ? 'Add to version control' : `Add ${formatCount(privateChanges.length)} items to version control`,
      icon: Plus,
      run: () => void addToSourceControl(workspacePath, privateChanges),
    },
    checkoutCandidates.length > 0 && {
      id: 'checkout',
      label: 'Check out',
      icon: PenLine,
      run: () => void checkout(workspacePath, checkoutCandidates),
    },
    controlledChanges.length > 0 && {
      id: 'undo',
      label: controlledChanges.length === 1 ? 'Undo changes' : `Undo ${formatCount(controlledChanges.length)} changes`,
      icon: Undo2,
      danger: true,
      run: () => void undoChanges(workspacePath, controlledChanges),
    },
    privateChanges.length > 0 && {
      id: 'trash',
      label: 'Move to trash',
      icon: Trash2,
      danger: true,
      run: () => void deletePrivateFiles(workspacePath, privateChanges),
    },
    SEPARATOR,
    moveToChangelistSubmenu(workspacePath, changes, changelists),
    single && filterRulesSubmenu(workspacePath, single.path),
    {
      label: 'Copy',
      icon: Copy,
      entries: [
        { id: 'copy.relative', label: 'Copy relative path', run: () => copyPaths(changes.map((change) => change.path)) },
        {
          id: 'copy.absolute',
          label: 'Copy full path',
          run: () => copyPaths(changes.map((change) => absolutePath(workspacePath, change.path))),
        },
      ],
    },
  ]);
}

/** Include the unchecked changes in the next check-in, or exclude the checked ones. */
function inclusionEntries(changes: PendingChange[], { isIncluded, setIncluded }: CheckinInclusion): MenuEntry[] {
  const candidates = changes.filter(isCheckinCandidate);
  const excluded = candidates.filter((change) => !isIncluded(change));
  const included = candidates.filter(isIncluded);
  return tidyMenu([
    excluded.length > 0 && { id: 'include', label: 'Include in check-in', icon: SquareCheckBig, run: () => setIncluded(excluded, true) },
    included.length > 0 && { id: 'exclude', label: 'Exclude from check-in', icon: Square, run: () => setIncluded(included, false) },
  ]);
}

/** Adds an item, or all files with its extension, to the ignore, cloaked or hidden-changes rules. */
export function filterRulesSubmenu(workspacePath: string, path: string): Submenu {
  const extension = extensionOf(path);
  const patternsFor = (list: FilterRuleList): MenuEntry[] =>
    tidyMenu([
      { id: `${list}.path`, label: `This item (/${path})`, run: () => void addFilterRule(workspacePath, list, `/${path}`) },
      extension !== null && { id: `${list}.extension`, label: `All ${extension} files`, run: () => void addFilterRule(workspacePath, list, `*${extension}`) },
    ]);

  return {
    label: 'Ignore, cloak or hide',
    icon: EyeOff,
    entries: [
      { label: `Add to ${FILTER_LIST_FILES.ignore}`, icon: EyeOff, entries: patternsFor('ignore') },
      { label: `Add to ${FILTER_LIST_FILES.cloaked}`, icon: FileClock, entries: patternsFor('cloaked') },
      { label: `Add to ${FILTER_LIST_FILES.hidden}`, entries: patternsFor('hidden') },
    ],
  };
}
