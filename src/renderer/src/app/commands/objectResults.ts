import { workspacePlace } from '@shared/domain/place';
import { Archive, File, Folder, GitBranch, GitCommitVertical, MessageSquareCode, Tag } from 'lucide-react';
import type { Place } from '@shared/domain/place';
import type { WorkspaceSelector } from '@shared/domain/workspace';
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
import { filterHaystack, wordMatchQuality } from '../../lib/matchesAllWords';
import { commentLineText, commentText } from '../../lib/comments/commentText';
import { excerptAroundMatch, type Excerpt } from '../../lib/matchExcerpt';
import { wordMatchPositions, wordMatchRanges } from '../../lib/textMatchRanges';
import { displayName } from '../../lib/userName';
import { navigation } from '../navigation/navigationStore';
import { annotatedHistory } from '../../features/history/annotatedHistory';
import type { SearchResult } from './searchResults';

/** What the palette's results need to know about the window's place, and the typed search (empty to list without matching). */
export interface ResultContext {
  place: Place;
  term: string;
  currentBranch?: string;
  loadedChangeset?: number | null;
  /** What the workspace is on, for the menus that switch to an object (`codeReviewMenu`). */
  workspaceOn?: WorkspaceSelector;
  changelists: Changelist[];
  changeAt: (path: string) => PendingChange | undefined;
}

/** A workspace's file or pending change, from the lists only a workspace has (`paletteGroups`). */
export function fileResult(entry: { path: string; isDirectory: boolean }, workspacePath: string, context: ResultContext): SearchResult {
  const { term } = context;
  const separator = entry.path.lastIndexOf('/');
  const nameStart = separator + 1;
  const matches = fuzzyMatchPositions(entry.path, term);
  const change = context.changeAt(entry.path);
  const reveal = (): void => {
    navigation.goToView('files');
    useFilesViewStore.getState().requestReveal(workspacePlace(workspacePath), entry.path);
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
    menuAction('history', () => navigation.openPage({ kind: 'history', path: entry.path })),
    !entry.isDirectory && menuAction('annotate', () => navigation.openPage(annotatedHistory({ path: entry.path }))),
    ...openOnDiskEntries({ path: absolutePath(workspacePath, entry.path), isFolder: entry.isDirectory }),
    itemCopySubmenu(workspacePath, [entry.path]),
  ]);
}

/**
 * How an object was found: its name ranked by the fuzzy index, or, for what a server search brought, by the words
 * typed; or by the words typed in its name and description (`createWordFilterIndex`). Its highlight marks the same
 * letters.
 */
export type ObjectMatch = 'fuzzy' | 'words' | 'description';

/**
 * A match in a description ranks a tier below the same match in a name (the name is what a branch or label is known
 * by): the words together in a description (0.8) tie with the words in a name's folders (0.7), and the name comes first.
 */
const DESCRIPTION_MATCH_PENALTY = 0.1;

/**
 * A hidden branch ranks after a visible one that matches as well, and still before one that matches a tier less well
 * (half a tier): hidden branches are found, as the user may be on one, but are rarely what is looked for.
 */
const HIDDEN_BRANCH_PENALTY = 0.05;

/**
 * `quality` lowered by `penalty`, rounded to the hundredths the tiers and the penalties are: 0.8 − 0.1 would otherwise
 * be a hair above a name's 0.7, and 0.7 − 0.05 a hair below 0.65.
 */
function lowered(quality: number, penalty: number): number {
  return Math.round((quality - penalty) * 100) / 100;
}

type MatchShown = Pick<SearchResult, 'labelMatches' | 'detail' | 'detailMatches' | 'quality'>;

/** How a named object's row shows the way it was found; `detail` is what it shows when found by its name. */
function matchShown(name: string, description: string, detail: string, term: string, match: ObjectMatch): MatchShown {
  const excerpt = match === 'description' ? excerptAroundMatch(commentText(description), term) : undefined;
  // Found among the rows holding the words, but the description shows none of them: the name held them all (or they
  // are only in what the description hides, a link's address), so the row is a name hit.
  if (excerpt && excerpt.matches.length > 0) return descriptionMatchShown(name, description, term, excerpt);
  return {
    labelMatches: match === 'fuzzy' ? fuzzyMatchPositions(name, term) : wordMatchPositions(name, term),
    quality: term ? fuzzyMatchQuality(name, term) : undefined,
    detail,
    detailMatches: [],
  };
}

/**
 * Found by its description: the description takes the detail's place, cut to keep the match in view, so the row shows
 * why it matched; the words typed are marked there and in the name.
 */
function descriptionMatchShown(name: string, description: string, term: string, excerpt: Excerpt): MatchShown {
  return {
    labelMatches: wordMatchPositions(name, term),
    detail: excerpt.text,
    detailMatches: excerpt.matches,
    quality: lowered(wordMatchQuality(filterHaystack([name, description]), term), DESCRIPTION_MATCH_PENALTY),
  };
}

export function branchResult(branch: Branch, context: ResultContext, match: ObjectMatch = 'fuzzy'): SearchResult {
  const { term, currentBranch } = context;
  const shown = matchShown(branch.name, branch.comment, `${displayName(branch.owner)} · ${formatRelativeDate(branch.date)}`, term, match);
  return {
    id: `branch:${branch.id}`,
    icon: GitBranch,
    label: branch.name,
    labelIsBranch: true,
    ...shown,
    quality: branch.isHidden && shown.quality !== undefined ? lowered(shown.quality, HIDDEN_BRANCH_PENALTY) : shown.quality,
    isCurrent: branch.name === currentBranch,
    isHidden: branch.isHidden,
    menu: () => branchMenu(context.place, [branch], currentBranch),
    run: () => diffBranch(branch),
  };
}

export function labelResult(label: Label, context: ResultContext, match: ObjectMatch = 'fuzzy'): SearchResult {
  const { term } = context;
  return {
    id: `label:${label.id}`,
    icon: Tag,
    label: label.name,
    ...matchShown(label.name, label.comment, `cs:${label.changeset} · ${formatRelativeDate(label.date)}`, term, match),
    menu: () => labelMenu(context.place, [label]),
    run: () => showLabelChanges(label),
  };
}

export function changesetResult(changeset: Changeset, context: ResultContext): SearchResult {
  const { term, loadedChangeset, currentBranch } = context;
  return {
    id: `changeset:${changeset.id}`,
    icon: GitCommitVertical,
    label: commentLineText(changeset.comment) || '(no comment)',
    detail: `cs:${changeset.id} · ${displayName(changeset.owner)} · ${formatRelativeDate(changeset.date)}`,
    detailMatches: specMatches(`cs:${changeset.id}`, term),
    quality: term ? Math.max(wordMatchQuality(changeset.comment, term), wordMatchQuality(`cs:${changeset.id}`, term)) : undefined,
    menu: () => changesetMenu({ place: context.place, loadedChangeset, loadedBranch: currentBranch }, [changeset]),
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
  const { term } = context;
  return {
    id: `shelve:${shelve.id}`,
    icon: Archive,
    label: commentLineText(shelve.comment) || '(no comment)',
    detail: `sh:${shelve.id} · ${displayName(shelve.owner)} · ${formatRelativeDate(shelve.date)}`,
    detailMatches: specMatches(`sh:${shelve.id}`, term),
    quality: term ? Math.max(wordMatchQuality(shelve.comment, term), wordMatchQuality(`sh:${shelve.id}`, term)) : undefined,
    menu: () => shelveMenu(context.place, [shelve]),
    run: () => showShelveChanges(shelve),
  };
}

export function codeReviewResult(review: CodeReviewSummary, context: ResultContext): SearchResult {
  const { term } = context;
  return {
    id: `codeReview:${review.id}`,
    icon: MessageSquareCode,
    label: commentLineText(review.title),
    detail: `${review.status} · ${displayName(review.owner)}`,
    detailMatches: [],
    quality: wordMatchQuality(review.title, term),
    menu: () => codeReviewMenu(context.place, [review], context.workspaceOn),
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
