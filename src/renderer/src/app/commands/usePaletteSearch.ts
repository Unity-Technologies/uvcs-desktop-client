import { useMemo } from 'react';
import { isCheckinCandidate } from '../../features/pendingChanges/changeCategories';
// The palette lists changes as the flat list does.
import { sortByStatus } from '../../features/pendingChanges/changeOrder';
import { createFuzzyIndex } from '../../lib/fuzzyIndex';
import type { ResultContext } from './objectResults';
import { paletteGroups } from './paletteGroups';
import { isSearching, type PaletteScope } from './paletteScope';
import type { SearchGroup } from './searchResults';
import { usePaletteLists } from './usePaletteLists';
import { useChangesetSearch, usePaletteServerSearch, useRefreshWhenMissing } from './usePaletteServerSearch';

export interface PaletteSearch {
  groups: SearchGroup[];
  /** Some list or server search is still running; more results may come. */
  isLoading: boolean;
}

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
  const { files, pendingChanges, workspace, recentBranchGuids: recentBranches, branches, labels, changesets, shelves, codeReviews } =
    usePaletteLists(workspacePath);
  const server = usePaletteServerSearch(workspacePath, term, scope);
  const { term: serverTerm, branches: foundBranches, labels: foundLabels, shelves: foundShelves, codeReviews: foundCodeReviews } = server;
  const { term: changesetSearchTerm, found: foundChangesets, start: setChangesetSearchTerm } = useChangesetSearch(workspacePath);

  // Branches and labels are cached in full, so a server match missing from them means they are out of date.
  useRefreshWhenMissing(foundBranches.data, branches.data, path, 'branches');
  useRefreshWhenMissing(foundLabels.data, labels.data, path, 'labels');

  const fileIndex = useMemo(() => createFuzzyIndex(files.data?.map((entry) => entry.path) ?? []), [files.data]);
  const branchIndex = useMemo(() => createFuzzyIndex(branches.data?.map((branch) => branch.name) ?? []), [branches.data]);
  const labelIndex = useMemo(() => createFuzzyIndex(labels.data?.map((label) => label.name) ?? []), [labels.data]);
  const changes = useMemo(() => sortByStatus((pendingChanges.data?.changes ?? []).filter(isCheckinCandidate)), [pendingChanges.data]);

  const serverWaits = (search: { isFetching: boolean }): boolean => server.searches && (serverTerm !== term || search.isFetching);
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
