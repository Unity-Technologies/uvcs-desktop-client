import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
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
import { sinceDateFor } from '../../lib/sincePresets';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { queryClient, SLOW_CHANGING_QUERY } from '../queryClient';
import { useWorkspaceInfoOf } from '../workspace/useWorkspace';
import type { ResultContext } from './objectResults';
import { lacksServerMatch, paletteGroups, searchesServerFor } from './paletteGroups';
import { isInScope, isSearching, type PaletteScope, type SectionId } from './paletteScope';
import type { SearchGroup } from './searchResults';

export interface PaletteSearch {
  groups: SearchGroup[];
  /** Some list or server search is still running; more results may come. */
  isLoading: boolean;
}

/** Older changesets are still reachable by number (`1234` or `cs:1234`) or by searching them all on demand. */
const RECENT_CHANGESETS = 2000;
/** Room for the loose matches of a case-tolerant server search, which are filtered precisely here. */
const SERVER_SEARCH_LIMIT = 50;
const SERVER_SEARCH_DELAY_MS = 300;
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
    queryFn: () => api.codeReviews.listSummaries(path, {}),
    ...cached,
  });

  // Server searches, once typing pauses, only for the sections in scope.
  const serverTerm = useDebouncedValue(term, SERVER_SEARCH_DELAY_MS);
  const searchesServer = enabled && searchesServerFor(serverTerm);
  const server = (section: SectionId) => ({ enabled: searchesServer && isInScope(section, scope), staleTime: STALE_TIME });
  const textFilter: QueryFilter = { text: serverTerm, limit: SERVER_SEARCH_LIMIT };
  const foundBranches = useQuery({ queryKey: branchesKey(path, textFilter), queryFn: () => api.branches.list(path, textFilter), ...server('branches') });
  const foundLabels = useQuery({ queryKey: labelsKey(path, textFilter), queryFn: () => api.labels.list(path, textFilter), ...server('labels') });
  const foundShelves = useQuery({ queryKey: shelvesKey(path, textFilter), queryFn: () => api.shelves.list(path, textFilter), ...server('shelves') });
  const foundCodeReviews = useQuery({
    queryKey: reviewSummariesKey(path, serverTerm),
    queryFn: () => api.codeReviews.listSummaries(path, { text: serverTerm }),
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
    return paletteGroups({
      scope,
      context,
      lists: {
        files: files.data && { items: files.data, index: fileIndex },
        changes,
        branches: branches.data && { items: branches.data, index: branchIndex },
        labels: labels.data && { items: labels.data, index: labelIndex },
        changesets: changesets.data,
        shelves: shelves.data,
        codeReviews: codeReviews.data,
        recentBranchGuids: recentBranches,
      },
      server: { term: serverTerm, branches: foundBranches.data, labels: foundLabels.data, shelves: foundShelves.data, codeReviews: foundCodeReviews.data },
      changesetSearch: {
        term: changesetSearchTerm,
        found: foundChangesets.data,
        isFetching: foundChangesets.isFetching,
        error: foundChangesets.error,
        start: setChangesetSearchTerm,
      },
    });
  }, [
    enabled,
    path,
    term,
    scope,
    serverTerm,
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
    if (!lacksServerMatch(found, cached)) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.inWorkspace(workspacePath, area, {}), exact: true });
  }, [found, cached, workspacePath, area]);
}
