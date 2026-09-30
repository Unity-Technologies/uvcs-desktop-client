import { LoaderCircle, Search } from 'lucide-react';
import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { Label } from '@shared/domain/label';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { Shelve } from '@shared/domain/shelve';
import { typedChangesetNumber } from '../../lib/changesetNumber';
import type { FuzzyIndex } from '../../lib/fuzzyIndex';
import { matchesAllWords } from '../../lib/matchesAllWords';
import {
  branchResult,
  changesetResult,
  codeReviewResult,
  exactChangesetResult,
  fileResult,
  labelResult,
  shelveResult,
  type ResultContext,
} from './objectResults';
import { isInScope, type PaletteScope } from './paletteScope';
import type { SearchGroup, SearchResult } from './searchResults';

/** Rows a section can show once expanded; each section shows fewer until then (see `collapseGroups`). */
export const MAX_PER_SECTION = 50;
/** Server matches that the cached lists missed (new, or beyond their limits), added after the cached ones. */
const MAX_SERVER_EXTRAS = 3;
/** `like` patterns drop each word's first letter (`caseTolerantPattern`): two letters would match nearly everything. */
const MIN_SERVER_SEARCH_LENGTH = 3;
/** Whether a (settled) term is worth asking the server about: long enough, and not a changeset number. */
export function searchesServerFor(serverTerm: string): boolean {
  return serverTerm.length >= MIN_SERVER_SEARCH_LENGTH && typedChangesetNumber(serverTerm) === undefined;
}

/** Whether the server found something a fully cached list lacks: then that list is out of date. */
export function lacksServerMatch(found: readonly { id: number }[] | undefined, cached: readonly { id: number }[] | undefined): boolean {
  if (!found || !cached) return false;
  const cachedIds = new Set(cached.map((item) => item.id));
  return found.some((item) => !cachedIds.has(item.id));
}

interface WorkspacePathEntry {
  path: string;
  isDirectory: boolean;
}

/** A cached list with the fuzzy index over its names (`createFuzzyIndex`), built once per list. */
export interface IndexedList<T> {
  items: readonly T[];
  index: FuzzyIndex;
}

/** The lists read once and kept, which answer every keystroke. Undefined while still loading. */
export interface CachedLists {
  files?: IndexedList<WorkspacePathEntry>;
  /** The pending changes that could be checked in, in the order Changes shows them. */
  changes: readonly PendingChange[];
  branches?: IndexedList<Branch>;
  labels?: IndexedList<Label>;
  changesets?: readonly Changeset[];
  shelves?: readonly Shelve[];
  codeReviews?: readonly CodeReviewSummary[];
  /** GUIDs (lowercase) of the branches switched to lately, most recent first. */
  recentBranchGuids: readonly string[];
}

/** What the server found for `term` (the term as typing last paused), to add what the cached lists miss. */
export interface ServerMatches {
  term: string;
  branches?: readonly Branch[];
  labels?: readonly Label[];
  shelves?: readonly Shelve[];
  codeReviews?: readonly CodeReviewSummary[];
}

/** The on-demand search of every changeset's comment. */
export interface ChangesetSearch {
  /** The term it was asked for; undefined until asked. */
  term?: string;
  found?: readonly Changeset[];
  isFetching: boolean;
  error: Error | null;
  /** Asks for it, for the term typed. */
  start: (term: string) => void;
}

export interface PaletteGroupsInput {
  scope: PaletteScope;
  /** `term` is what is typed, trimmed; empty lists what is at hand. */
  context: ResultContext;
  lists: CachedLists;
  server: ServerMatches;
  changesetSearch: ChangesetSearch;
}

/**
 * The palette's object sections, in the scope: without a search, what is at hand (pending changes, the current, recent
 * and newest branches, the latest changesets and shelves; labels only when asked for with `@`); with one, the cached
 * lists' matches followed by the few the server found that they miss. Empty sections are left out.
 */
export function paletteGroups(input: PaletteGroupsInput): SearchGroup[] {
  const groups = input.context.term ? searchGroups(input) : listGroups(input);
  return groups.filter((group) => group.results.length > 0 && isInScope(group.section, input.scope));
}

function listGroups({ scope, context, lists }: PaletteGroupsInput): SearchGroup[] {
  const branches = byRecency(lists.branches?.items ?? [], context.currentBranch, lists.recentBranchGuids);
  return [
    { section: 'branches', heading: 'Branches', results: firstOnes(branches).map((branch) => branchResult(branch, context)) },
    // Labels pile up by the thousand; without a search they only show when asked for (`@`).
    {
      section: 'labels',
      heading: 'Labels',
      results: scope === 'refs' ? firstOnes(lists.labels?.items ?? []).map((label) => labelResult(label, context)) : [],
    },
    {
      section: 'files',
      heading: 'Pending changes',
      results: firstOnes(lists.changes).map((change) => fileResult({ path: change.path, isDirectory: change.itemType === 'directory' }, context)),
    },
    { section: 'changesets', heading: 'Changesets', results: firstOnes(lists.changesets ?? []).map((changeset) => changesetResult(changeset, context)) },
    {
      section: 'shelves',
      heading: 'Shelves',
      results: firstOnes([...(lists.shelves ?? [])].sort((a, b) => b.id - a.id)).map((shelve) => shelveResult(shelve, context)),
    },
  ];
}

/** The current branch, the ones switched to lately, then the rest in the list's order (the newest). */
function byRecency(branches: readonly Branch[], currentBranch: string | undefined, recentGuids: readonly string[]): Branch[] {
  const rank = (branch: Branch): number => {
    if (branch.name === currentBranch) return 0;
    const recent = recentGuids.indexOf(branch.guid.toLowerCase());
    return recent === -1 ? recentGuids.length + 1 : recent + 1;
  };
  return branches
    .map((branch, order) => ({ branch, order }))
    .sort((a, b) => rank(a.branch) - rank(b.branch) || a.order - b.order)
    .map(({ branch }) => branch);
}

function searchGroups({ context, lists, server, changesetSearch }: PaletteGroupsInput): SearchGroup[] {
  const { term } = context;
  // A changeset typed (`1234` or `cs:1234`) opens it, whether or not it is recent.
  const changesetNumber = typedChangesetNumber(term);
  const withServerMatches = <T,>(local: SearchResult[], found: readonly T[] | undefined, textOf: (item: T) => string, toResult: (item: T) => SearchResult) =>
    addServerMatches(local, server.term === term ? found : undefined, term, textOf, toResult);

  const recentChangesetResults = firstOnes(
    (lists.changesets ?? []).filter(
      (changeset) => changeset.id !== changesetNumber && matchesAllWords(`cs:${changeset.id} ${changeset.comment}`, term),
    ),
  ).map((changeset) => changesetResult(changeset, context));

  return [
    { section: 'files', heading: 'Files', results: ranked(lists.files, term).map((entry) => fileResult(entry, context)) },
    {
      section: 'branches',
      heading: 'Branches',
      results: withServerMatches(
        ranked(lists.branches, term).map((branch) => branchResult(branch, context)),
        server.branches,
        (branch) => branch.name,
        (branch) => branchResult(branch, context, 'words'),
      ),
    },
    {
      section: 'labels',
      heading: 'Labels',
      results: withServerMatches(
        ranked(lists.labels, term).map((label) => labelResult(label, context)),
        server.labels,
        (label) => label.name,
        (label) => labelResult(label, context, 'words'),
      ),
    },
    {
      section: 'changesets',
      heading: 'Changesets',
      results: [
        ...(changesetNumber !== undefined ? [exactChangeset(changesetNumber, lists.changesets, context)] : []),
        ...recentChangesetResults,
        ...searchAllChangesets(term, changesetSearch, recentChangesetResults, context),
      ],
    },
    {
      section: 'shelves',
      heading: 'Shelves',
      results: withServerMatches(
        firstOnes((lists.shelves ?? []).filter((shelve) => matchesAllWords(`sh:${shelve.id} ${shelve.comment}`, term))).map((shelve) =>
          shelveResult(shelve, context),
        ),
        server.shelves,
        (shelve) => shelve.comment,
        (shelve) => shelveResult(shelve, context),
      ),
    },
    {
      section: 'codeReviews',
      heading: 'Code reviews',
      results: withServerMatches(
        firstOnes((lists.codeReviews ?? []).filter((review) => matchesAllWords(review.title, term))).map((review) => codeReviewResult(review, context)),
        server.codeReviews,
        (review) => review.title,
        (review) => codeReviewResult(review, context),
      ),
    },
  ];
}

function firstOnes<T>(items: readonly T[]): T[] {
  return items.slice(0, MAX_PER_SECTION);
}

function ranked<T>(list: IndexedList<T> | undefined, term: string): T[] {
  return list ? list.index.rank(term, MAX_PER_SECTION).map((index) => list.items[index]!) : [];
}

/**
 * Adds, after the cached list's matches, the first few server matches it lacks that have every word typed. `found`
 * is undefined when the server's answer is for an older term: it would not fit what is typed now.
 */
function addServerMatches<T>(
  local: SearchResult[],
  found: readonly T[] | undefined,
  term: string,
  textOf: (item: T) => string,
  toResult: (item: T) => SearchResult,
): SearchResult[] {
  if (!found) return local;
  const shown = new Set(local.map((result) => result.id));
  const extras = found
    .filter((item) => matchesAllWords(textOf(item), term))
    .map(toResult)
    .filter((result) => !shown.has(result.id));
  return [...local, ...extras.slice(0, MAX_SERVER_EXTRAS)];
}

/** A recent changeset shows with its comment; an older one is opened by number alone. */
function exactChangeset(id: number, recent: readonly Changeset[] | undefined, context: ResultContext): SearchResult {
  const changeset = recent?.find((candidate) => candidate.id === id);
  return changeset ? { ...changesetResult(changeset, context), quality: 1 } : exactChangesetResult(id);
}

/** The row offering to search every changeset's comment, then telling how that search goes, then what it found. */
function searchAllChangesets(term: string, search: ChangesetSearch, recentResults: SearchResult[], context: ResultContext): SearchResult[] {
  if (typedChangesetNumber(term) !== undefined || term.length < MIN_SERVER_SEARCH_LENGTH) return [];
  // Explicit empty matches: these rows describe the search, so the query is not highlighted in them.
  const action = { id: 'changeset:searchAll', keepOpen: true, pinned: true, labelMatches: [], detailMatches: [] };
  if (search.term !== term) {
    return [{ ...action, icon: Search, label: `Search all changesets for “${term}”`, detail: 'May take a few seconds', run: () => search.start(term) }];
  }
  if (search.isFetching) return [{ ...action, icon: LoaderCircle, busy: true, label: 'Searching all changesets…', run: () => {} }];
  if (search.error) return [{ ...action, icon: Search, label: `Could not search changesets: ${search.error.message}`, disabled: true, run: () => {} }];

  const shown = new Set(recentResults.map((result) => result.id));
  const older = (search.found ?? [])
    .filter((changeset) => matchesAllWords(changeset.comment, term))
    .map((changeset) => changesetResult(changeset, context))
    .filter((result) => !shown.has(result.id));
  return older.length > 0 ? older : [{ ...action, icon: Search, label: `No other changesets mention “${term}”`, disabled: true, run: () => {} }];
}
