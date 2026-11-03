import { EyeClosed, EyeOff, FileClock } from 'lucide-react';
import { canAnnotate } from '@shared/domain/annotate';
import { workspacePlace } from '@shared/domain/place';
import type { Changelist, FilterRuleList, PendingChange } from '@shared/domain/pendingChanges';
import { navigation } from '../../app/navigation/navigationStore';
import { annotatedHistory } from '../history/annotatedHistory';
import { tidyMenu, type MenuEntry } from '../../lib/actions';
import { groupedMenu, type GroupedEntry } from '../../lib/menuGroups';
import { copySubmenu, type CopyTexts } from '../../components/copyMenu';
import { hotkey } from '../../lib/shortcutRegistry';
import { openOnDiskEntries } from '../../components/externalApps/openWithMenu';
import { toolsSubmenu } from '../../components/tools/toolsMenu';
import { toolSubject } from '../../components/tools/toolSubjects';
import { menuAction, menuSubmenu } from '../../components/menuWords';
import { openFile } from '../../components/externalApps/externalAppOperations';
import { withMetas } from '../../lib/unityMetaPairs';
import { requestMetaDiff } from './changesMetaDiff';
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

/**
 * What the list the menu opens in knows beyond the changes. Each is left out where it isn't at hand (the command
 * palette), and so are the entries it offers.
 */
export interface PendingChangeMenuContext {
  /** Offers to include or exclude the changes: there is a check-in to pick for. */
  inclusion?: CheckinInclusion;
  /** Offers to mark the changes reviewed or clear their marks. */
  review?: ListReview<PendingChange>;
  /** Offers to show a locked change's lock. */
  locks?: PendingLocks;
  /** Every change listed, which Search matches pairs one with. */
  listed?: readonly PendingChange[];
  /** The Unity `.meta` each listed asset stands for too (`pairPendingMetas`): what changes data takes it along. */
  metaOf?: (change: PendingChange) => PendingChange | undefined;
}

/** The context menu for the selected pending changes. */
export function pendingChangeMenu(
  workspacePath: string,
  changes: PendingChange[],
  changelists: Changelist[],
  { inclusion, review, locks, listed, metaOf = () => undefined }: PendingChangeMenuContext = {},
): MenuEntry[] {
  if (changes.length === 0) return [];

  const single = changes.length === 1 ? changes[0]! : null;
  const meta = single ? metaOf(single) : undefined;
  // What changes data acts on the metas too; what views or opens an item takes the asset alone.
  const acted = withMetas(changes, metaOf);
  // Labels count the rows selected, as the list shows them: a joined meta is part of its asset's row.
  const joinedMetas = new Set(changes.map(metaOf));
  const rowCount = (among: readonly PendingChange[]): number => among.filter((change) => !joinedMetas.has(change)).length;
  const lock = single ? locks?.get(single.path) : undefined;
  const privateChanges = acted.filter((change) => categoryOf(change) === 'private');
  const controlledChanges = acted.filter(isControlled);
  const checkoutCandidates = controlledChanges.filter((change) => !change.kinds.includes('checkedOut') && !change.kinds.includes('added'));
  const onDisk = single && existsOnDisk(single);
  const matchSide = single && listed ? matchSideOf(single, listed) : null;

  return groupedMenu([
    ...(inclusion ? inclusionEntries(acted, inclusion) : []),
    review && reviewMenuEntry(changes, review),
    meta && menuAction('metaDiff', () => requestMetaDiff(workspacePath, single!.path)),
    privateChanges.length > 0 &&
      menuAction('add', () => void addToSourceControl(workspacePath, privateChanges), {
        label: rowCount(privateChanges) === 1 ? 'Add to version control' : `Add ${formatCount(rowCount(privateChanges))} items to version control`,
      }),
    checkoutCandidates.length > 0 && menuAction('checkout', () => void checkout(workspacePath, checkoutCandidates)),
    single && matchSide && listed && menuAction('searchMatches', () => void searchMatches(workspacePath, single, matchSide, listed)),
    single && hasRevisions(single) && menuAction('history', () => navigation.openPage({ kind: 'history', path: single.path })),
    single &&
      hasRevisions(single) &&
      canAnnotate(single.itemType) &&
      menuAction('annotate', () => navigation.openPage(annotatedHistory({ path: single.path }))),
    meta && hasRevisions(meta) && menuAction('metaHistory', () => navigation.openPage({ kind: 'history', path: meta.path })),
    lock && menuAction('showInLocks', () => showInLocks(workspacePath, lock)),
    ...(onDisk ? openOnDiskEntries({ path: absolutePath(workspacePath, single.path), isFolder: single.itemType === 'directory' }) : []),
    meta && existsOnDisk(meta) && menuAction('openMeta', () => void openFile(absolutePath(workspacePath, meta.path))),
    toolsSubmenu(workspacePlace(workspacePath), changes.filter(existsOnDisk).map((change) => toolSubject.item(absolutePath(workspacePath, change.path)))),
    itemCopySubmenu(workspacePath, changes.map((change) => change.path)),
    moveToChangelistSubmenu(workspacePath, acted, changelists),
    filterRulesSubmenu(workspacePath, acted.map((change) => change.path)),
    controlledChanges.length > 0 &&
      menuAction('undo', () => void undoChanges(workspacePath, controlledChanges), { label: undoChangesLabel(rowCount(controlledChanges)) }),
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
