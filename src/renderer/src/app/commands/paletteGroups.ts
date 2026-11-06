import { LoaderCircle, Search } from 'lucide-react';
import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { Label } from '@shared/domain/label';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { Shelve } from '@shared/domain/shelve';
import { workspacePathOf } from '@shared/domain/place';
import { typedChangesetNumber } from '../../lib/changesetNumber';
import type { FuzzyIndex } from '../../lib/fuzzyIndex';
import { matchesAllWords } from '../../lib/matchesAllWords';
import type { WordFilterIndex } from '../../lib/wordFilterIndex';
import {
  branchResult,
  changesetResult,
  codeReviewResult,
  exactChangesetResult,
  exactCodeReviewResult,
  exactShelveResult,
  fileResult,
  labelResult,
  shelveResult,
  type ObjectMatch,
  type ResultContext,
} from './objectResults';
import { rankCandidates, type CandidateIndex } from '../../lib/candidateRanking';
import { isInScope, type PaletteScope } from './paletteScope';
import { personResult } from './personResults';
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

/**
 * A cached list whose rows are found by their description too: the words of each row's name and description
 * (`createWordFilterIndex`), as its own view's filter finds them, built once per list.
 */
export interface DescribedList<T> extends IndexedList<T> {
  words: WordFilterIndex;
}

/**
 * Every branch the palette searches: the visible ones (the list the switcher and the Branches view share), then the
 * hidden ones, read apart (`onlyHidden`), which the user may be on.
 */
export function paletteBranches(visible: readonly Branch[], hidden: readonly Branch[]): Branch[] {
  return [...visible, ...hidden];
}

/** The lists read once and kept, which answer every keystroke. Undefined while still loading. */
export interface CachedLists {
  files?: IndexedList<WorkspacePathEntry>;
  /** The pending changes that could be checked in, in the order Changes shows them. */
  changes: readonly PendingChange[];
  branches?: DescribedList<Branch>;
  labels?: DescribedList<Label>;
  changesets?: readonly Changeset[];
  shelves?: readonly Shelve[];
  codeReviews?: readonly CodeReviewSummary[];
  /** GUIDs (lowercase) of the branches switched to lately, most recent first. */
  recentBranchGuids: readonly string[];
  /** Who `@` offers (`palettePeople`, `indexPeople`); read only once asked for. */
  people?: CandidateIndex<string>;
}

/** What the server found for `term` (the term as typing last paused), to add what the cached lists miss. */
export interface ServerMatches {
  term: string;
  branches?: readonly Branch[];
  labels?: readonly Label[];
  shelves?: readonly Shelve[];
  codeReviews?: readonly CodeReviewSummary[];
  /**
   * The review whose number the term is, as the server found it (`reviewNumberToLookUp`): empty when there is none.
   * Undefined until asked, and when nothing asks (a term that isn't a number, a review the newest ones read hold).
   */
  reviewNumbered?: readonly CodeReviewSummary[];
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
 * and newest branches, the latest changesets and shelves; labels, code reviews and people only when asked for with
 * `lb:`, `cr:` and `@`); with one, the cached
 * lists' matches followed by the few the server found that they miss. Empty sections are left out.
 */
export function paletteGroups(input: PaletteGroupsInput): SearchGroup[] {
  const groups = [...(input.context.term ? searchGroups(input) : listGroups(input)), peopleGroup(input)];
  return groups.filter((group) => group.results.length > 0 && isInScope(group.section, input.scope));
}

/** People, only when asked for (`@`): in any search, a name typed would list everyone who shares a word of it. */
function peopleGroup({ scope, context, lists }: PaletteGroupsInput): SearchGroup {
  const people = scope === 'people' && lists.people ? rankCandidates(lists.people, context.term, MAX_PER_SECTION) : [];
  return { section: 'people', heading: 'People', results: people.map((person) => personResult(person, context.me)) };
}

function listGroups({ scope, context, lists }: PaletteGroupsInput): SearchGroup[] {
  const workspacePath = workspacePathOf(context.place);
  const branches = byRecency(lists.branches?.items ?? [], context.currentBranch, lists.recentBranchGuids);
  return [
    { section: 'branches', heading: 'Branches', results: firstOnes(branches).map((branch) => branchResult(branch, context)) },
    // Labels pile up by the thousand; without a search they only show when asked for (`lb:`).
    {
      section: 'labels',
      heading: 'Labels',
      results: scope === 'labels' ? firstOnes(lists.labels?.items ?? []).map((label) => labelResult(label, context)) : [],
    },
    {
      section: 'files',
      heading: 'Pending changes',
      // A workspace's own: a repository explored without one has neither files nor pending changes.
      results:
        workspacePath === null
          ? []
          : firstOnes(lists.changes).map((change) => fileResult({ path: change.path, isDirectory: change.itemType === 'directory' }, workspacePath, context)),
    },
    { section: 'changesets', heading: 'Changesets', results: firstOnes(lists.changesets ?? []).map((changeset) => changesetResult(changeset, context)) },
    {
      section: 'shelves',
      heading: 'Shelves',
      results: firstOnes([...(lists.shelves ?? [])].sort((a, b) => b.id - a.id)).map((shelve) => shelveResult(shelve, context)),
    },
    // Reviews are what a branch is waiting on, not what is at hand: the newest show when asked for (`cr:`).
    {
      section: 'codeReviews',
      heading: 'Code reviews',
      results: scope === 'codeReviews' ? firstOnes(lists.codeReviews ?? []).map((review) => codeReviewResult(review, context)) : [],
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

function searchGroups({ scope, context, lists, server, changesetSearch }: PaletteGroupsInput): SearchGroup[] {
  const { term } = context;
  const shelveId = typedObjectNumber(term, scope, 'shelves');
  const reviewId = typedObjectNumber(term, scope, 'codeReviews');
  const workspacePath = workspacePathOf(context.place);
  // A changeset typed (`1234` or `cs:1234`) opens it, whether or not it is recent.
  const changesetNumber = typedChangesetNumber(term);
  const answered = <T,>(found: readonly T[] | undefined) => (server.term === term ? found : undefined);
  const withServerMatches = <T,>(local: SearchResult[], found: readonly T[] | undefined, textOf: (item: T) => string, toResult: (item: T) => SearchResult) =>
    addServerMatches(local, answered(found), term, textOf, toResult);
  // Only a number after its prefix opens what may not exist; a number alone names a shelve or review once it's known.
  const openShelveByNumber = scope === 'shelves' ? exactShelveResult : undefined;
  const openReviewByNumber = scope === 'codeReviews' ? exactCodeReviewResult : undefined;

  const recentChangesetResults = firstOnes(
    (lists.changesets ?? []).filter(
      (changeset) => changeset.id !== changesetNumber && matchesAllWords(`cs:${changeset.id} ${changeset.comment}`, term),
    ),
  ).map((changeset) => changesetResult(changeset, context));

  return [
    { section: 'files', heading: 'Files', results: workspacePath === null ? [] : ranked(lists.files, term).map((entry) => fileResult(entry, workspacePath, context)) },
    {
      section: 'branches',
      heading: 'Branches',
      results: withServerMatches(
        byNameThenDescription(lists.branches, term, (branch, match) => branchResult(branch, context, match)),
        server.branches,
        (branch) => branch.name,
        (branch) => branchResult(branch, context, 'words'),
      ),
    },
    {
      section: 'labels',
      heading: 'Labels',
      results: withServerMatches(
        byNameThenDescription(lists.labels, term, (label, match) => labelResult(label, context, match)),
        server.labels,
        (label) => label.name,
        (label) => labelResult(label, context, 'words'),
      ),
    },
    {
      section: 'changesets',
      heading: 'Changesets',
      results: [
        ...(changesetNumber !== undefined ? [exactChangeset(changesetNumber, lists.changesets, context, scope)] : []),
        ...recentChangesetResults,
        ...searchAllChangesets(term, changesetSearch, recentChangesetResults, context),
      ],
    },
    {
      section: 'shelves',
      heading: 'Shelves',
      results: namedFirst(
        shelveId,
        lists.shelves,
        (shelve) => shelveResult(shelve, context),
        openShelveByNumber,
        withServerMatches(
          firstOnes((lists.shelves ?? []).filter((shelve) => matchesAllWords(`sh:${shelve.id} ${shelve.comment}`, term))).map((shelve) =>
            shelveResult(shelve, context),
          ),
          server.shelves,
          (shelve) => shelve.comment,
          (shelve) => shelveResult(shelve, context),
        ),
      ),
    },
    {
      section: 'codeReviews',
      heading: 'Code reviews',
      results: namedFirst(
        reviewId,
        [...(lists.codeReviews ?? []), ...(answered(server.reviewNumbered) ?? [])],
        (review) => codeReviewResult(review, context),
        openReviewByNumber,
        withServerMatches(
          firstOnes((lists.codeReviews ?? []).filter((review) => matchesAllWords(review.title, term))).map((review) => codeReviewResult(review, context)),
          server.codeReviews,
          (review) => review.title,
          (review) => codeReviewResult(review, context),
        ),
      ),
    },
  ];
}

/**
 * The shelve or code review number a search names: a number alone (`1234`, a changeset's too), or one after the
 * section's own prefix (`sh:4`, `cr:311`), as the spec does in a comment. Undefined for anything else, and in another
 * section's scope (`cs:1234`).
 */
export function typedObjectNumber(term: string, scope: PaletteScope, section: 'shelves' | 'codeReviews'): number | undefined {
  return isInScope(section, scope) && /^\d+$/.test(term) ? Number(term) : undefined;
}

/**
 * The code review number to ask the server about (`cm find review "where id = N"`, `ServerMatches.reviewNumbered`):
 * one typed (`typedObjectNumber`) that the newest reviews read don't hold. A number alone shows its review only once
 * it is known to exist, never as a row that opens to an error; review numbers are object ids, so on a large
 * repository they are far past every changeset's.
 */
export function reviewNumberToLookUp(term: string, scope: PaletteScope, newest: readonly { id: number }[] | undefined): number | undefined {
  const id = typedObjectNumber(term, scope, 'codeReviews');
  return id !== undefined && !newest?.some((review) => review.id === id) ? id : undefined;
}

/**
 * The object the search names by its id (`id`; undefined for none) first, as a full match, then the other matches
 * without it, as a changeset typed by number opens (`exactChangeset`): with its row when a list read holds it, else
 * by its number alone (`byNumber`), an older one the list doesn't reach, read only once it's picked. Without
 * `byNumber` (a number typed alone), only an object read is named.
 */
function namedFirst<T extends { id: number }>(
  id: number | undefined,
  read: readonly T[] | undefined,
  toResult: (item: T) => SearchResult,
  byNumber: ((id: number) => SearchResult) | undefined,
  matches: SearchResult[],
): SearchResult[] {
  if (id === undefined) return matches;
  const named = read?.find((item) => item.id === id);
  const exact = named ? { ...toResult(named), quality: 1 } : byNumber?.(id);
  return exact ? [exact, ...matches.filter((result) => result.id !== exact.id)] : matches;
}

function firstOnes<T>(items: readonly T[]): T[] {
  return items.slice(0, MAX_PER_SECTION);
}

function ranked<T>(list: IndexedList<T> | undefined, term: string): T[] {
  return list ? list.index.rank(term, MAX_PER_SECTION).map((index) => list.items[index]!) : [];
}

/**
 * The rows whose name matches fuzzily and those whose name and description hold every word typed (a description
 * says what a branch is for, which its name often doesn't), the best `MAX_PER_SECTION` of both: a description
 * ranks below the same match in a name (`branchResult`), and a name found first keeps its place on a tie, but a
 * description holding the words typed beats a name holding only their letters, scattered.
 */
function byNameThenDescription<T>(list: DescribedList<T> | undefined, term: string, toResult: (item: T, match: ObjectMatch) => SearchResult): SearchResult[] {
  if (!list) return [];
  const byName = list.index.rank(term, MAX_PER_SECTION);
  const shown = new Set(byName);
  const byDescription = list.words.matching(term, MAX_PER_SECTION, (row) => shown.has(row));
  const results = [...byName.map((row) => toResult(list.items[row]!, 'fuzzy')), ...byDescription.map((row) => toResult(list.items[row]!, 'description'))];
  // `sort` is stable: equal matches keep the order above, names first.
  return results.sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0)).slice(0, MAX_PER_SECTION);
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

/**
 * How well a number alone matches a changeset past the newest one read, which likely names none (one created since
 * would be just past it): below the shelve or code review the same number names, which then comes first, yet close
 * enough to the best to stay (`rankGroups`).
 */
export const UNLIKELY_CHANGESET_QUALITY = 0.9;

/**
 * A recent changeset shows with its comment; an older one is opened by number alone. A number alone past the newest
 * changeset read ranks below a full match (`UNLIKELY_CHANGESET_QUALITY`); after `cs:` it's what was asked for.
 */
function exactChangeset(id: number, recent: readonly Changeset[] | undefined, context: ResultContext, scope: PaletteScope): SearchResult {
  const changeset = recent?.find((candidate) => candidate.id === id);
  if (changeset) return { ...changesetResult(changeset, context), quality: 1 };
  const newest = recent?.reduce((highest, candidate) => Math.max(highest, candidate.id), -1) ?? -1;
  const unlikely = scope === 'all' && newest >= 0 && id > newest;
  return { ...exactChangesetResult(id), quality: unlikely ? UNLIKELY_CHANGESET_QUALITY : 1 };
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
