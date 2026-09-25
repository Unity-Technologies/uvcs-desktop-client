import { useQuery } from '@tanstack/react-query';
import { Archive, File, Folder, GitBranch, GitCommitVertical, LoaderCircle, MessageSquareCode, Search, Tag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { Label } from '@shared/domain/label';
import type { QueryFilter } from '@shared/domain/query';
import type { Shelve } from '@shared/domain/shelve';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { diffBranch } from '../../features/branches/branchOperations';
import { openChangesetDiff } from '../../features/changesets/changesetOperations';
import { openReview } from '../../features/codeReviews/codeReviewOperations';
import { useFilesViewStore } from '../../features/files/filesViewStore';
import { useWorkspacePaths } from '../../features/files/useWorkspacePaths';
import { showLabelChanges } from '../../features/labels/labelOperations';
import { showShelveChanges } from '../../features/shelves/shelveOperations';
import { formatRelativeDate } from '../../lib/formatDate';
import { createFuzzyIndex, fuzzyMatchPositions, fuzzyMatchQuality } from '../../lib/fuzzyIndex';
import { matchesAllWords, wordMatchQuality } from '../../lib/matchesAllWords';
import { firstLine } from '../../lib/text';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { displayName } from '../../lib/userName';
import { navigation } from '../navigation/navigationStore';
import { queryClient } from '../queryClient';
import type { SearchGroup, SearchResult } from './searchResults';

export interface PaletteSearch {
  groups: SearchGroup[];
  /** Some list or server search is still running; more results may come. */
  isLoading: boolean;
}

const MAX_FILES = 8;
const MAX_PER_KIND = 5;
/** Server matches that the cached lists missed (new, or beyond their limits), added after the cached ones. */
const MAX_SERVER_EXTRAS = 3;
/** Older changesets are still reachable by number (`1234` or `cs:1234`) or by searching them all on demand. */
const RECENT_CHANGESETS = 2000;
/** Room for the loose matches of a case-tolerant server search, which are filtered precisely here. */
const SERVER_SEARCH_LIMIT = 50;
const SERVER_SEARCH_DELAY_MS = 300;
const MIN_SERVER_SEARCH_LENGTH = 2;
const CHANGESET_NUMBER = /^(?:cs:)?(\d+)$/i;
const STALE_TIME = 60_000;
/** Keeps the lists between palette openings, so reopening it never starts from scratch. */
const CACHE_TIME = 30 * 60_000;

/**
 * Searches the workspace files and the repository objects (branches, labels, changesets, shelves, code reviews)
 * for the command palette, in two layers (the palette ranks the groups against each other, see `rankGroups`):
 * - cached lists, fetched once and refreshed in the background, answer every keystroke instantly and fuzzily;
 * - once typing pauses, `cm find ... like` asks the server for what the cache may miss (objects created since, or
 *   beyond the cached limits). Changeset comments take seconds to search on big repositories, so only on demand.
 */
export function usePaletteSearch(workspacePath: string | null, query: string): PaletteSearch {
  const enabled = Boolean(workspacePath);
  const path = workspacePath ?? '';
  const term = query.trim();
  const changesetNumber = CHANGESET_NUMBER.exec(term)?.[1];

  // Cached lists.
  const cached = { enabled, staleTime: STALE_TIME, gcTime: CACHE_TIME };
  const recentFilter: QueryFilter = { limit: RECENT_CHANGESETS };
  const files = useWorkspacePaths(path, enabled);
  const branches = useQuery({ queryKey: branchesKey(path, {}), queryFn: () => api.branches.list(path, {}), ...cached });
  const labels = useQuery({ queryKey: labelsKey(path, {}), queryFn: () => api.labels.list(path, {}), ...cached });
  const changesets = useQuery({ queryKey: changesetsKey(path, recentFilter), queryFn: () => api.changesets.list(path, recentFilter), ...cached });
  const shelves = useQuery({ queryKey: shelvesKey(path, {}), queryFn: () => api.shelves.list(path, {}), ...cached });
  const codeReviews = useQuery({ queryKey: codeReviewsKey(path, undefined), queryFn: () => api.codeReviews.listSummaries(path, { scope: 'all' }), ...cached });

  // Server searches, once typing pauses.
  const serverTerm = useDebouncedValue(term, SERVER_SEARCH_DELAY_MS);
  const searchesServer = enabled && serverTerm.length >= MIN_SERVER_SEARCH_LENGTH && !CHANGESET_NUMBER.test(serverTerm);
  const server = { enabled: searchesServer, staleTime: STALE_TIME };
  const textFilter: QueryFilter = { text: serverTerm, limit: SERVER_SEARCH_LIMIT };
  const foundBranches = useQuery({ queryKey: branchesKey(path, textFilter), queryFn: () => api.branches.list(path, textFilter), ...server });
  const foundLabels = useQuery({ queryKey: labelsKey(path, textFilter), queryFn: () => api.labels.list(path, textFilter), ...server });
  const foundShelves = useQuery({ queryKey: shelvesKey(path, textFilter), queryFn: () => api.shelves.list(path, textFilter), ...server });
  const foundCodeReviews = useQuery({
    queryKey: codeReviewsKey(path, serverTerm),
    queryFn: () => api.codeReviews.listSummaries(path, { scope: 'all', text: serverTerm }),
    ...server,
  });

  const [changesetSearchTerm, setChangesetSearchTerm] = useState<string>();
  const changesetFilter: QueryFilter = { text: changesetSearchTerm, limit: SERVER_SEARCH_LIMIT };
  const foundChangesets = useQuery({
    queryKey: changesetsKey(path, changesetFilter),
    queryFn: () => api.changesets.list(path, changesetFilter),
    enabled: enabled && changesetSearchTerm !== undefined,
    staleTime: STALE_TIME,
  });

  // Branches, labels and shelves are cached in full, so a server match missing from them means they are out of date.
  useRefreshWhenMissing(foundBranches.data, branches.data, path, 'branches');
  useRefreshWhenMissing(foundLabels.data, labels.data, path, 'labels');
  useRefreshWhenMissing(foundShelves.data, shelves.data, path, 'shelves');

  const fileIndex = useMemo(() => createFuzzyIndex(files.data?.map((entry) => entry.path) ?? []), [files.data]);
  const branchIndex = useMemo(() => createFuzzyIndex(branches.data?.map((branch) => branch.name) ?? []), [branches.data]);
  const labelIndex = useMemo(() => createFuzzyIndex(labels.data?.map((label) => label.name) ?? []), [labels.data]);

  const isLoading =
    enabled &&
    ([files, branches, labels, changesets, shelves, codeReviews].some((list) => list.isPending) ||
      (searchesServer && (serverTerm !== term || [foundBranches, foundLabels, foundShelves, foundCodeReviews].some((search) => search.isFetching))));

  const groups = useMemo(() => {
    if (!enabled || !term) return [];

    const withServerMatches = <T,>(
      local: SearchResult[],
      found: T[] | undefined,
      textOf: (item: T) => string,
      toResult: (item: T) => SearchResult,
    ): SearchResult[] => {
      // Matches for an older term would not fit what is typed now.
      if (serverTerm !== term || !found) return local;
      const shown = new Set(local.map((result) => result.id));
      const extras = found
        .filter((item) => matchesAllWords(textOf(item), term))
        .map(toResult)
        .filter((result) => !shown.has(result.id));
      return [...local, ...extras.slice(0, MAX_SERVER_EXTRAS)];
    };

    const recentChangesetResults = (changesets.data ?? [])
      .filter((changeset) => String(changeset.id) !== changesetNumber && matchesAllWords(`cs:${changeset.id} ${changeset.comment}`, term))
      .slice(0, MAX_PER_KIND)
      .map((changeset) => changesetResult(changeset, term));

    const searchAllChangesets = (): SearchResult[] => {
      if (changesetNumber || term.length < MIN_SERVER_SEARCH_LENGTH) return [];
      const id = 'changeset:searchAll';
      if (changesetSearchTerm !== term) {
        const run = () => setChangesetSearchTerm(term);
        return [{ id, icon: Search, label: `Search all changesets for “${term}”`, labelMatches: [], detail: 'May take a few seconds', keepOpen: true, run }];
      }
      if (foundChangesets.isFetching) return [{ id, icon: LoaderCircle, busy: true, label: 'Searching all changesets…', keepOpen: true, run: () => {} }];
      if (foundChangesets.error) return [{ id, icon: Search, label: `Could not search changesets: ${foundChangesets.error.message}`, disabled: true, run: () => {} }];

      const shown = new Set(recentChangesetResults.map((result) => result.id));
      const older = (foundChangesets.data ?? [])
        .filter((changeset) => matchesAllWords(changeset.comment, term))
        .map((changeset) => changesetResult(changeset, term))
        .filter((result) => !shown.has(result.id));
      return older.length > 0 ? older : [{ id, icon: Search, label: `No other changesets mention “${term}”`, labelMatches: [], disabled: true, run: () => {} }];
    };

    const all: SearchGroup[] = [
      { heading: 'Files', results: fileIndex.rank(term, MAX_FILES).map((index) => fileResult(files.data![index]!, term)) },
      {
        heading: 'Branches',
        results: withServerMatches(
          branchIndex.rank(term, MAX_PER_KIND).map((index) => branchResult(branches.data![index]!, term)),
          foundBranches.data,
          (branch) => branch.name,
          (branch) => branchResult(branch, term),
        ),
      },
      {
        heading: 'Labels',
        results: withServerMatches(
          labelIndex.rank(term, MAX_PER_KIND).map((index) => labelResult(labels.data![index]!, term)),
          foundLabels.data,
          (label) => label.name,
          (label) => labelResult(label, term),
        ),
      },
      {
        heading: 'Changesets',
        results: [...(changesetNumber ? [exactChangesetResult(Number(changesetNumber))] : []), ...recentChangesetResults, ...searchAllChangesets()],
      },
      {
        heading: 'Shelves',
        results: withServerMatches(
          (shelves.data ?? [])
            .filter((shelve) => matchesAllWords(`sh:${shelve.id} ${shelve.comment}`, term))
            .slice(0, MAX_PER_KIND)
            .map((shelve) => shelveResult(shelve, term)),
          foundShelves.data,
          (shelve) => shelve.comment,
          (shelve) => shelveResult(shelve, term),
        ),
      },
      {
        heading: 'Code reviews',
        results: withServerMatches(
          (codeReviews.data ?? []).filter((review) => matchesAllWords(review.title, term)).slice(0, MAX_PER_KIND).map((review) => codeReviewResult(review, term)),
          foundCodeReviews.data,
          (review) => review.title,
          (review) => codeReviewResult(review, term),
        ),
      },
    ];
    return all.filter((group) => group.results.length > 0);
  }, [
    enabled,
    term,
    serverTerm,
    changesetNumber,
    fileIndex,
    files.data,
    branchIndex,
    branches.data,
    labelIndex,
    labels.data,
    changesets.data,
    shelves.data,
    codeReviews.data,
    foundBranches.data,
    foundLabels.data,
    foundShelves.data,
    foundCodeReviews.data,
    changesetSearchTerm,
    foundChangesets.data,
    foundChangesets.isFetching,
    foundChangesets.error,
  ]);

  return { groups, isLoading };
}

function branchesKey(workspacePath: string, filter: QueryFilter) {
  return queryKeys.inWorkspace(workspacePath, 'branches', filter);
}

function labelsKey(workspacePath: string, filter: QueryFilter) {
  return queryKeys.inWorkspace(workspacePath, 'labels', filter);
}

function changesetsKey(workspacePath: string, filter: QueryFilter) {
  return queryKeys.inWorkspace(workspacePath, 'changesets', filter);
}

function shelvesKey(workspacePath: string, filter: QueryFilter) {
  return queryKeys.inWorkspace(workspacePath, 'shelves', filter);
}

function codeReviewsKey(workspacePath: string, text: string | undefined) {
  return queryKeys.inWorkspace(workspacePath, 'codeReviews', 'summaries', { scope: 'all', text });
}

/** Re-reads a fully cached list (`{}` filter) when the server found something it lacks. */
function useRefreshWhenMissing(
  found: { id: number }[] | undefined,
  cached: { id: number }[] | undefined,
  workspacePath: string,
  area: 'branches' | 'labels' | 'shelves',
): void {
  useEffect(() => {
    if (!found || !cached) return;
    const cachedIds = new Set(cached.map((item) => item.id));
    if (!found.some((item) => !cachedIds.has(item.id))) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.inWorkspace(workspacePath, area, {}), exact: true });
  }, [found, cached, workspacePath, area]);
}

function fileResult(entry: { path: string; isDirectory: boolean }, term: string): SearchResult {
  const separator = entry.path.lastIndexOf('/');
  const nameStart = separator + 1;
  const matches = fuzzyMatchPositions(entry.path, term);
  return {
    id: `file:${entry.path}`,
    icon: entry.isDirectory ? Folder : File,
    label: entry.path.slice(nameStart),
    detail: entry.path.slice(0, Math.max(separator, 0)),
    labelMatches: matches.filter((position) => position >= nameStart).map((position) => position - nameStart),
    quality: fuzzyMatchQuality(entry.path, term),
    detailMatches: matches.filter((position) => position < separator),
    run: () => {
      navigation.goToView('files');
      useFilesViewStore.getState().requestReveal(entry.path);
    },
  };
}

function branchResult(branch: Branch, term: string): SearchResult {
  return {
    id: `branch:${branch.id}`,
    icon: GitBranch,
    label: branch.name,
    labelMatches: fuzzyMatchPositions(branch.name, term),
    quality: fuzzyMatchQuality(branch.name, term),
    detail: `${displayName(branch.owner)} · ${formatRelativeDate(branch.date)}`,
    run: () => diffBranch(branch.name),
  };
}

function labelResult(label: Label, term: string): SearchResult {
  return {
    id: `label:${label.id}`,
    icon: Tag,
    label: label.name,
    labelMatches: fuzzyMatchPositions(label.name, term),
    quality: fuzzyMatchQuality(label.name, term),
    detail: `cs:${label.changeset} · ${formatRelativeDate(label.date)}`,
    run: () => showLabelChanges(label),
  };
}

function changesetResult(changeset: Changeset, term: string): SearchResult {
  return {
    id: `changeset:${changeset.id}`,
    icon: GitCommitVertical,
    label: firstLine(changeset.comment) || '(no comment)',
    detail: `cs:${changeset.id} · ${displayName(changeset.owner)} · ${formatRelativeDate(changeset.date)}`,
    quality: Math.max(wordMatchQuality(changeset.comment, term), wordMatchQuality(`cs:${changeset.id}`, term)),
    run: () => openChangesetDiff(changeset),
  };
}

function exactChangesetResult(changesetId: number): SearchResult {
  return {
    id: `changeset:${changesetId}`,
    icon: GitCommitVertical,
    label: `Changeset ${changesetId}`,
    quality: 1,
    run: () => openChangesetDiff({ id: changesetId }),
  };
}

function shelveResult(shelve: Shelve, term: string): SearchResult {
  return {
    id: `shelve:${shelve.id}`,
    icon: Archive,
    label: firstLine(shelve.comment) || '(no comment)',
    detail: `sh:${shelve.id} · ${displayName(shelve.owner)} · ${formatRelativeDate(shelve.date)}`,
    quality: Math.max(wordMatchQuality(shelve.comment, term), wordMatchQuality(`sh:${shelve.id}`, term)),
    run: () => showShelveChanges(shelve),
  };
}

function codeReviewResult(review: CodeReviewSummary, term: string): SearchResult {
  return {
    id: `codeReview:${review.id}`,
    icon: MessageSquareCode,
    label: review.title,
    detail: `${review.status} · ${displayName(review.owner)}`,
    quality: wordMatchQuality(review.title, term),
    run: () => openReview(review),
  };
}
