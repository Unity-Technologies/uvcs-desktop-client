import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useRecentBranchGuids } from '../../features/branches/recentBranches';
import { reviewSummariesKey } from '../../features/codeReviews/useCodeReviews';
import { useWorkspacePaths } from '../../features/files/useWorkspacePaths';
import { isCheckinCandidate } from '../../features/pendingChanges/changeCategories';
import { sortByStatus } from '../../features/pendingChanges/changeRows';
import { usePendingChangesOf } from '../../features/pendingChanges/usePendingChanges';
import { createFuzzyIndex } from '../../lib/fuzzyIndex';
import { matchesAllWords } from '../../lib/matchesAllWords';
import { sinceDateFor } from '../../lib/sincePresets';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { queryClient, SLOW_CHANGING_QUERY } from '../queryClient';
import { useWorkspaceInfoOf } from '../workspace/useWorkspace';
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
import { isInScope, isSearching, type PaletteScope, type SectionId } from './paletteScope';
import type { SearchGroup, SearchResult } from './searchResults';

export interface PaletteSearch {
  groups: SearchGroup[];
  /** Some list or server search is still running; more results may come. */
  isLoading: boolean;
}

/** Rows a section can show once expanded; each section shows fewer until then (see `collapseGroups`). */
const MAX_PER_SECTION = 50;
/** Server matches that the cached lists missed (new, or beyond their limits), added after the cached ones. */
const MAX_SERVER_EXTRAS = 3;
/** Older changesets are still reachable by number (`1234` or `cs:1234`) or by searching them all on demand. */
const RECENT_CHANGESETS = 2000;
/** Room for the loose matches of a case-tolerant server search, which are filtered precisely here. */
const SERVER_SEARCH_LIMIT = 50;
const SERVER_SEARCH_DELAY_MS = 300;
/** `like` patterns drop each word's first letter (`caseTolerantPattern`): two letters would match nearly everything. */
const MIN_SERVER_SEARCH_LENGTH = 3;
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
 * Without a search it lists what is at hand: the pending changes, the current, recent and newest branches, the
 * latest changesets and shelves. Sections outside `scope` are left out.
 */
export function usePaletteSearch(workspacePath: string | null, query: string, scope: PaletteScope): PaletteSearch {
  const enabled = Boolean(workspacePath);
  const path = workspacePath ?? '';
  const term = query.trim();
  const changesetNumber = CHANGESET_NUMBER.exec(term)?.[1];

  // Cached lists.
  const cached = { enabled, ...SLOW_CHANGING_QUERY, gcTime: CACHE_TIME };
  const recentFilter: QueryFilter = { limit: RECENT_CHANGESETS };
  // Shelves by everyone pile up by the thousand; older ones are still found by the server search.
  const recentShelvesFilter: QueryFilter = { sinceDate: sinceDateFor('last3Months') };
  const files = useWorkspacePaths(path, enabled);
  const pendingChanges = usePendingChangesOf(workspacePath);
  const workspace = useWorkspaceInfoOf(workspacePath);
  const recentBranches = useRecentBranchGuids(path, enabled);
  const branches = useQuery({ queryKey: branchesKey(path, {}), queryFn: () => api.branches.list(path, {}), ...cached });
  const labels = useQuery({ queryKey: labelsKey(path, {}), queryFn: () => api.labels.list(path, {}), ...cached });
  const changesets = useQuery({
    queryKey: changesetsKey(path, recentFilter),
    queryFn: () => api.changesets.list(path, recentFilter),
    ...cached,
    // New changesets come by the minute.
    staleTime: STALE_TIME,
  });
  const shelves = useQuery({ queryKey: shelvesKey(path, recentShelvesFilter), queryFn: () => api.shelves.list(path, recentShelvesFilter), ...cached });
  const codeReviews = useQuery({
    // The same newest reviews the branch chips read (`useReviewsByBranch`): one query for both.
    queryKey: reviewSummariesKey(path),
    queryFn: () => api.codeReviews.listSummaries(path, { scope: 'all' }),
    ...cached,
  });

  // Server searches, once typing pauses, only for the sections in scope.
  const serverTerm = useDebouncedValue(term, SERVER_SEARCH_DELAY_MS);
  const searchesServer = enabled && serverTerm.length >= MIN_SERVER_SEARCH_LENGTH && !CHANGESET_NUMBER.test(serverTerm);
  const server = (section: SectionId) => ({ enabled: searchesServer && isInScope(section, scope), staleTime: STALE_TIME });
  const textFilter: QueryFilter = { text: serverTerm, limit: SERVER_SEARCH_LIMIT };
  const foundBranches = useQuery({ queryKey: branchesKey(path, textFilter), queryFn: () => api.branches.list(path, textFilter), ...server('branches') });
  const foundLabels = useQuery({ queryKey: labelsKey(path, textFilter), queryFn: () => api.labels.list(path, textFilter), ...server('labels') });
  const foundShelves = useQuery({ queryKey: shelvesKey(path, textFilter), queryFn: () => api.shelves.list(path, textFilter), ...server('shelves') });
  const foundCodeReviews = useQuery({
    queryKey: reviewSummariesKey(path, serverTerm),
    queryFn: () => api.codeReviews.listSummaries(path, { scope: 'all', text: serverTerm }),
    ...server('codeReviews'),
  });

  const [changesetSearchTerm, setChangesetSearchTerm] = useState<string>();
  const changesetFilter: QueryFilter = { text: changesetSearchTerm, limit: SERVER_SEARCH_LIMIT };
  const foundChangesets = useQuery({
    queryKey: changesetsKey(path, changesetFilter),
    queryFn: () => api.changesets.list(path, changesetFilter),
    enabled: enabled && changesetSearchTerm !== undefined,
    staleTime: STALE_TIME,
  });

  // Branches and labels are cached in full, so a server match missing from them means they are out of date.
  useRefreshWhenMissing(foundBranches.data, branches.data, path, 'branches');
  useRefreshWhenMissing(foundLabels.data, labels.data, path, 'labels');

  const fileIndex = useMemo(() => createFuzzyIndex(files.data?.map((entry) => entry.path) ?? []), [files.data]);
  const branchIndex = useMemo(() => createFuzzyIndex(branches.data?.map((branch) => branch.name) ?? []), [branches.data]);
  const labelIndex = useMemo(() => createFuzzyIndex(labels.data?.map((label) => label.name) ?? []), [labels.data]);
  const changes = useMemo(() => sortByStatus((pendingChanges.data?.changes ?? []).filter(isCheckinCandidate)), [pendingChanges.data]);

  const serverWaits = (search: { isFetching: boolean }): boolean => searchesServer && (serverTerm !== term || search.isFetching);
  const isLoading =
    enabled &&
    isSearching(
      [
        { section: 'files', waiting: files.isPending },
        { section: 'branches', waiting: branches.isPending || serverWaits(foundBranches) },
        { section: 'labels', waiting: labels.isPending || serverWaits(foundLabels) },
        { section: 'changesets', waiting: changesets.isPending },
        { section: 'shelves', waiting: shelves.isPending || serverWaits(foundShelves) },
        { section: 'codeReviews', waiting: codeReviews.isPending || serverWaits(foundCodeReviews) },
      ],
      scope,
    );

  const groups = useMemo(() => {
    if (!enabled) return [];

    const changeByPath = new Map(changes.map((change) => [change.path, change]));
    const context: ResultContext = {
      workspacePath: path,
      term,
      currentBranch: workspace.data?.selector.kind === 'branch' ? workspace.data.selector.name : undefined,
      loadedChangeset: workspace.data?.loadedChangeset,
      changelists: pendingChanges.data?.changelists ?? [],
      changeAt: (changePath) => changeByPath.get(changePath),
    };

    const listGroups = (): SearchGroup[] => {
      // The current branch, the ones switched to lately, then the newest.
      const rank = (branch: Branch): number => {
        if (branch.name === context.currentBranch) return 0;
        const recent = recentBranches.indexOf(branch.guid.toLowerCase());
        return recent === -1 ? recentBranches.length + 1 : recent + 1;
      };
      const sortedBranches = (branches.data ?? []).map((branch, order) => ({ branch, order })).sort((a, b) => rank(a.branch) - rank(b.branch) || a.order - b.order);
      return [
        {
          section: 'branches',
          heading: 'Branches',
          results: sortedBranches.slice(0, MAX_PER_SECTION).map(({ branch }) => branchResult(branch, context)),
        },
        // Labels pile up by the thousand; without a search they only show when asked for (`@`).
        {
          section: 'labels',
          heading: 'Labels',
          results: scope === 'refs' ? (labels.data ?? []).slice(0, MAX_PER_SECTION).map((label) => labelResult(label, context)) : [],
        },
        {
          section: 'files',
          heading: 'Pending changes',
          results: changes
            .slice(0, MAX_PER_SECTION)
            .map((change) => fileResult({ path: change.path, isDirectory: change.itemType === 'directory' }, context)),
        },
        {
          section: 'changesets',
          heading: 'Changesets',
          results: (changesets.data ?? []).slice(0, MAX_PER_SECTION).map((changeset) => changesetResult(changeset, context)),
        },
        {
          section: 'shelves',
          heading: 'Shelves',
          results: [...(shelves.data ?? [])]
            .sort((a, b) => b.id - a.id)
            .slice(0, MAX_PER_SECTION)
            .map((shelve) => shelveResult(shelve, context)),
        },
      ];
    };

    const searchGroups = (): SearchGroup[] => {
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

      // A recent changeset shows with its comment; an older one is opened by number alone.
      const exactChangeset = (id: number): SearchResult => {
        const recent = changesets.data?.find((changeset) => changeset.id === id);
        return recent ? { ...changesetResult(recent, context), quality: 1 } : exactChangesetResult(id);
      };

      const recentChangesetResults = (changesets.data ?? [])
        .filter((changeset) => String(changeset.id) !== changesetNumber && matchesAllWords(`cs:${changeset.id} ${changeset.comment}`, term))
        .slice(0, MAX_PER_SECTION)
        .map((changeset) => changesetResult(changeset, context));

      const searchAllChangesets = (): SearchResult[] => {
        if (changesetNumber || term.length < MIN_SERVER_SEARCH_LENGTH) return [];
        // Explicit empty matches: these rows describe the search, so the query is not highlighted in them.
        const action = { id: 'changeset:searchAll', keepOpen: true, pinned: true, labelMatches: [], detailMatches: [] };
        if (changesetSearchTerm !== term) {
          return [{ ...action, icon: Search, label: `Search all changesets for “${term}”`, detail: 'May take a few seconds', run: () => setChangesetSearchTerm(term) }];
        }
        if (foundChangesets.isFetching) return [{ ...action, icon: LoaderCircle, busy: true, label: 'Searching all changesets…', run: () => {} }];
        if (foundChangesets.error) {
          return [{ ...action, icon: Search, label: `Could not search changesets: ${foundChangesets.error.message}`, disabled: true, run: () => {} }];
        }

        const shown = new Set(recentChangesetResults.map((result) => result.id));
        const older = (foundChangesets.data ?? [])
          .filter((changeset) => matchesAllWords(changeset.comment, term))
          .map((changeset) => changesetResult(changeset, context))
          .filter((result) => !shown.has(result.id));
        return older.length > 0 ? older : [{ ...action, icon: Search, label: `No other changesets mention “${term}”`, disabled: true, run: () => {} }];
      };

      return [
        { section: 'files', heading: 'Files', results: fileIndex.rank(term, MAX_PER_SECTION).map((index) => fileResult(files.data![index]!, context)) },
        {
          section: 'branches',
          heading: 'Branches',
          results: withServerMatches(
            branchIndex.rank(term, MAX_PER_SECTION).map((index) => branchResult(branches.data![index]!, context)),
            foundBranches.data,
            (branch) => branch.name,
            (branch) => branchResult(branch, context),
          ),
        },
        {
          section: 'labels',
          heading: 'Labels',
          results: withServerMatches(
            labelIndex.rank(term, MAX_PER_SECTION).map((index) => labelResult(labels.data![index]!, context)),
            foundLabels.data,
            (label) => label.name,
            (label) => labelResult(label, context),
          ),
        },
        {
          section: 'changesets',
          heading: 'Changesets',
          results: [...(changesetNumber ? [exactChangeset(Number(changesetNumber))] : []), ...recentChangesetResults, ...searchAllChangesets()],
        },
        {
          section: 'shelves',
          heading: 'Shelves',
          results: withServerMatches(
            (shelves.data ?? [])
              .filter((shelve) => matchesAllWords(`sh:${shelve.id} ${shelve.comment}`, term))
              .slice(0, MAX_PER_SECTION)
              .map((shelve) => shelveResult(shelve, context)),
            foundShelves.data,
            (shelve) => shelve.comment,
            (shelve) => shelveResult(shelve, context),
          ),
        },
        {
          section: 'codeReviews',
          heading: 'Code reviews',
          results: withServerMatches(
            (codeReviews.data ?? [])
              .filter((review) => matchesAllWords(review.title, term))
              .slice(0, MAX_PER_SECTION)
              .map((review) => codeReviewResult(review, context)),
            foundCodeReviews.data,
            (review) => review.title,
            (review) => codeReviewResult(review, context),
          ),
        },
      ];
    };

    return (term ? searchGroups() : listGroups()).filter((group) => group.results.length > 0 && isInScope(group.section, scope));
  }, [
    enabled,
    path,
    term,
    scope,
    serverTerm,
    changesetNumber,
    workspace.data,
    recentBranches,
    pendingChanges.data,
    changes,
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

/** Re-reads a fully cached list (`{}` filter) when the server found something it lacks. */
function useRefreshWhenMissing(
  found: { id: number }[] | undefined,
  cached: { id: number }[] | undefined,
  workspacePath: string,
  area: 'branches' | 'labels',
): void {
  useEffect(() => {
    if (!found || !cached) return;
    const cachedIds = new Set(cached.map((item) => item.id));
    if (!found.some((item) => !cachedIds.has(item.id))) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.inWorkspace(workspacePath, area, {}), exact: true });
  }, [found, cached, workspacePath, area]);
}
