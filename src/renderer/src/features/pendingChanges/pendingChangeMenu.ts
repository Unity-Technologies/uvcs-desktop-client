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
  Trash2,
  Undo2,
} from 'lucide-react';
import type { FilterRuleList, PendingChange } from '@shared/domain/pendingChanges';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { SEPARATOR, tidyMenu, type MenuEntry, type Submenu } from '../../lib/actions';
import { categoryOf, isControlled } from './changeCategories';
import {
  absolutePath,
  addFilterRule,
  addToSourceControl,
  checkout,
  copyPaths,
  deletePrivateFiles,
  extensionOf,
  FILTER_LIST_FILES,
  undoChanges,
} from './pendingChangeOperations';

/** The context menu for the selected pending changes. */
export function pendingChangeMenu(workspacePath: string, changes: PendingChange[]): MenuEntry[] {
  if (changes.length === 0) return [];

  const single = changes.length === 1 ? changes[0]! : null;
  const privateChanges = changes.filter((change) => categoryOf(change) === 'private');
  const controlledChanges = changes.filter(isControlled);
  const checkoutCandidates = controlledChanges.filter((change) => !change.kinds.includes('checkedOut') && !change.kinds.includes('added'));
  const existsOnDisk = single && !single.kinds.includes('deleted') && !single.kinds.includes('locallyDeleted');

  return tidyMenu([
    existsOnDisk && {
      id: 'open',
      label: 'Open',
      icon: AppWindow,
      run: () => void api.system.openPath(absolutePath(workspacePath, single.path)),
    },
    existsOnDisk && {
      id: 'reveal',
      label: 'Reveal in file manager',
      icon: FolderSearch,
      run: () => void api.system.revealInFileManager(absolutePath(workspacePath, single.path)),
    },
    SEPARATOR,
    single && isControlled(single) && {
      id: 'history',
      label: 'View history',
      icon: History,
      run: () => navigation.openPage({ kind: 'history', path: single.path }),
    },
    single && isControlled(single) && single.itemType !== 'directory' && {
      id: 'annotate',
      label: 'Annotate',
      icon: ScanText,
      run: () => navigation.openPage({ kind: 'annotate', path: single.path }),
    },
    SEPARATOR,
    privateChanges.length > 0 && {
      id: 'add',
      label: privateChanges.length === 1 ? 'Add to version control' : `Add ${privateChanges.length} items to version control`,
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
      label: controlledChanges.length === 1 ? 'Undo changes' : `Undo ${controlledChanges.length} changes`,
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
    single && filterRulesSubmenu(workspacePath, single),
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

function filterRulesSubmenu(workspacePath: string, change: PendingChange): Submenu {
  const extension = extensionOf(change.path);
  const patternsFor = (list: FilterRuleList): MenuEntry[] =>
    tidyMenu([
      { id: `${list}.path`, label: `This item (/${change.path})`, run: () => void addFilterRule(workspacePath, list, `/${change.path}`) },
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
