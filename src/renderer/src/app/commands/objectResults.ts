import { Archive, File, Folder, GitBranch, GitCommitVertical, MessageSquareCode, Tag } from 'lucide-react';
import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { Label } from '@shared/domain/label';
import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import type { Shelve } from '@shared/domain/shelve';
import { branchMenu } from '../../features/branches/branchMenu';
import { diffBranch } from '../../features/branches/branchOperations';
import { changesetMenu } from '../../features/changesets/changesetMenu';
import { openChangesetDiff } from '../../features/changesets/changesetOperations';
import { codeReviewMenu } from '../../features/codeReviews/codeReviewMenu';
import { openReview } from '../../features/codeReviews/codeReviewOperations';
import { openItem } from '../../features/files/fileOperations';
import { useFilesViewStore } from '../../features/files/filesViewStore';
import { labelMenu } from '../../features/labels/labelMenu';
import { showLabelChanges } from '../../features/labels/labelOperations';
import { describeKinds } from '../../features/pendingChanges/changeCategories';
import { changeTone } from '../../features/pendingChanges/changeTone';
import { itemCopySubmenu, pendingChangeMenu } from '../../features/pendingChanges/pendingChangeMenu';
import { absolutePath } from '../../features/pendingChanges/pendingChangeOperations';
import { shelveMenu } from '../../features/shelves/shelveMenu';
import { showShelveChanges } from '../../features/shelves/shelveOperations';
import type { MenuEntry } from '../../lib/actions';
import { formatRelativeDate } from '../../lib/formatDate';
import { groupedMenu, withEntries } from '../../lib/menuGroups';
import { openOnDiskEntries } from '../../components/externalApps/openWithMenu';
import { menuAction } from '../../components/menuWords';
import { fuzzyMatchPositions, fuzzyMatchQuality } from '../../lib/fuzzyIndex';
import { wordMatchQuality } from '../../lib/matchesAllWords';
import { firstLine } from '../../lib/text';
import { wordMatchPositions, wordMatchRanges } from '../../lib/textMatchRanges';
import { displayName } from '../../lib/userName';
import { navigation } from '../navigation/navigationStore';
import { annotatedHistory } from '../../features/history/annotatedHistory';
import type { SearchResult } from './searchResults';

/** What the palette's results need to know about the workspace, and the typed search (empty to list without matching). */
export interface ResultContext {
  workspacePath: string;
  term: string;
  currentBranch?: string;
  loadedChangeset?: number | null;
  changelists: Changelist[];
  changeAt: (path: string) => PendingChange | undefined;
}

export function fileResult(entry: { path: string; isDirectory: boolean }, context: ResultContext): SearchResult {
  const { workspacePath, term } = context;
  const separator = entry.path.lastIndexOf('/');
  const nameStart = separator + 1;
  const matches = fuzzyMatchPositions(entry.path, term);
  const change = context.changeAt(entry.path);
  const reveal = (): void => {
    navigation.goToView('files');
    useFilesViewStore.getState().requestReveal(entry.path);
  };
  return {
    id: `file:${entry.path}`,
    icon: entry.isDirectory ? Folder : File,
    label: entry.path.slice(nameStart),
    detail: entry.path.slice(0, Math.max(separator, 0)),
    labelMatches: matches.filter((position) => position >= nameStart).map((position) => position - nameStart),
    detailMatches: matches.filter((position) => position < separator),
    quality: term ? fuzzyMatchQuality(entry.path, term) : undefined,
    status: change && { tone: changeTone(change), title: describeKinds(change) },
    menu: () =>
      withEntries(change ? pendingChangeMenu(workspacePath, [change], context.changelists) : workspaceFileMenu(workspacePath, entry), [
        menuAction('showInFiles', reveal),
      ]),
    run: reveal,
  };
}

/** For files without pending changes, which the Files view's menu would need their revision details for. */
function workspaceFileMenu(workspacePath: string, entry: { path: string; isDirectory: boolean }): MenuEntry[] {
  return groupedMenu([
    !entry.isDirectory && menuAction('open', () => openItem(workspacePath, entry)),
    menuAction('history', () => navigation.openPage({ kind: 'history', path: entry.path })),
    !entry.isDirectory && menuAction('annotate', () => navigation.openPage(annotatedHistory({ path: entry.path }))),
    ...openOnDiskEntries({ path: absolutePath(workspacePath, entry.path), isFolder: entry.isDirectory }),
    itemCopySubmenu(workspacePath, [entry.path]),
  ]);
}

/**
 * How a name was found: ranked by the fuzzy index, or, for what a server search brought, by the words typed; its
 * highlight marks the same letters.
 */
export type NameMatch = 'fuzzy' | 'words';

function namePositions(name: string, term: string, match: NameMatch): number[] {
  return match === 'fuzzy' ? fuzzyMatchPositions(name, term) : wordMatchPositions(name, term);
}

export function branchResult(branch: Branch, context: ResultContext, match: NameMatch = 'fuzzy'): SearchResult {
  const { workspacePath, term, currentBranch } = context;
  return {
    id: `branch:${branch.id}`,
    icon: GitBranch,
    label: branch.name,
    labelIsBranch: true,
    labelMatches: namePositions(branch.name, term, match),
    quality: term ? fuzzyMatchQuality(branch.name, term) : undefined,
    detail: `${displayName(branch.owner)} · ${formatRelativeDate(branch.date)}`,
    detailMatches: [],
    isCurrent: branch.name === currentBranch,
    menu: () => branchMenu(workspacePath, [branch], currentBranch),
    run: () => diffBranch(branch),
  };
}

export function labelResult(label: Label, context: ResultContext, match: NameMatch = 'fuzzy'): SearchResult {
  const { workspacePath, term } = context;
  return {
    id: `label:${label.id}`,
    icon: Tag,
    label: label.name,
    labelMatches: namePositions(label.name, term, match),
    quality: term ? fuzzyMatchQuality(label.name, term) : undefined,
    detail: `cs:${label.changeset} · ${formatRelativeDate(label.date)}`,
    detailMatches: [],
    menu: () => labelMenu(workspacePath, [label]),
    run: () => showLabelChanges(label),
  };
}

export function changesetResult(changeset: Changeset, context: ResultContext): SearchResult {
  const { workspacePath, term, loadedChangeset, currentBranch } = context;
  return {
    id: `changeset:${changeset.id}`,
    icon: GitCommitVertical,
    label: firstLine(changeset.comment) || '(no comment)',
    detail: `cs:${changeset.id} · ${displayName(changeset.owner)} · ${formatRelativeDate(changeset.date)}`,
    detailMatches: specMatches(`cs:${changeset.id}`, term),
    quality: term ? Math.max(wordMatchQuality(changeset.comment, term), wordMatchQuality(`cs:${changeset.id}`, term)) : undefined,
    menu: () => changesetMenu({ workspacePath, loadedChangeset, loadedBranch: currentBranch }, [changeset]),
    run: () => openChangesetDiff(changeset),
  };
}

export function exactChangesetResult(changesetId: number): SearchResult {
  return {
    id: `changeset:${changesetId}`,
    icon: GitCommitVertical,
    label: `Changeset ${changesetId}`,
    quality: 1,
    run: () => openChangesetDiff({ id: changesetId }),
  };
}

export function shelveResult(shelve: Shelve, context: ResultContext): SearchResult {
  const { workspacePath, term } = context;
  return {
    id: `shelve:${shelve.id}`,
    icon: Archive,
    label: firstLine(shelve.comment) || '(no comment)',
    detail: `sh:${shelve.id} · ${displayName(shelve.owner)} · ${formatRelativeDate(shelve.date)}`,
    detailMatches: specMatches(`sh:${shelve.id}`, term),
    quality: term ? Math.max(wordMatchQuality(shelve.comment, term), wordMatchQuality(`sh:${shelve.id}`, term)) : undefined,
    menu: () => shelveMenu(workspacePath, [shelve]),
    run: () => showShelveChanges(shelve),
  };
}

export function codeReviewResult(review: CodeReviewSummary, { workspacePath, term }: ResultContext): SearchResult {
  return {
    id: `codeReview:${review.id}`,
    icon: MessageSquareCode,
    label: review.title,
    detail: `${review.status} · ${displayName(review.owner)}`,
    detailMatches: [],
    quality: wordMatchQuality(review.title, term),
    menu: () => codeReviewMenu(workspacePath, [review]),
    run: () => openReview(review),
  };
}

/**
 * A detail line is searched only by its leading `cs:12` / `sh:3` spec, and only a number is looked for there; the
 * owner and date after it, or a single letter found in "cs", would highlight noise.
 */
function specMatches(spec: string, term: string): number[] {
  if (!/\d/.test(term)) return [];
  return wordMatchRanges(spec, term).flatMap(([start, end]) => Array.from({ length: end - start }, (_, offset) => start + offset));
}
