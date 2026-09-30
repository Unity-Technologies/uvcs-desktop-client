import { useMemo } from 'react';
import type { BranchExplorerData } from '@shared/domain/branchExplorer';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import { filterGraph, type GraphFocus } from './model/filterGraph';
import { layoutGraph, layoutKeeping, type GraphLayout, type PendingChangeset } from './model/layoutGraph';
import { rememberedPerHistory } from './model/rememberedPerHistory';
import type { SearchHit } from './model/searchGraph';
import { useSearchHits } from './useSearchHits';

interface GraphLayoutInputs {
  data: BranchExplorerData | undefined;
  /** The branch the view is focused on, which the filters then show with its related branches. */
  focus: GraphFocus | null;
  currentBranch: string | null;
  homeChangeset: number | null;
  pending: PendingChangeset | null;
  /** Changesets the user expanded out of "+N" nodes. */
  expanded: ReadonlySet<number>;
  /** What the search finds, lit and kept out of "+N" nodes. */
  search: string;
  selectedChangeset: number | null;
}

export interface GraphLayouts {
  /** The history the filters leave. */
  filtered: BranchExplorerData | null;
  /** Every changeset the filters leave, laid out: what search looks through. */
  fullLayout: GraphLayout | null;
  /** What the canvas draws: the full layout, or only the relevant changesets with the rest in "+N" nodes. */
  layout: GraphLayout | null;
  searchHits: SearchHit[];
}

/**
 * The history read, filtered and laid out as the view's filters say. Each step is remembered with the history, so
 * coming back to the view draws at once, and "Only relevant changesets" keeps out of its "+N" nodes the workspace,
 * the merges in progress, the search hits, a reveal's target and the selection.
 */
export function useGraphLayout({ data, focus, currentBranch, homeChangeset, pending, expanded, search, selectedChangeset }: GraphLayoutInputs): GraphLayouts {
  const { hideMergedBranches, onlyRelatedToCurrent, visibleBranches, structureOnly, revealRequest } = useBranchExplorerPreferences();

  const filtered = useMemo(() => {
    if (!data) return null;
    const related = focus ?? (onlyRelatedToCurrent && currentBranch ? { branch: currentBranch, hops: 1 } : null);
    return rememberedPerHistory(data, 'filtered', [related?.branch, related?.hops, visibleBranches, hideMergedBranches, currentBranch], () => {
      const chosen = visibleBranches && new Set(visibleBranches);
      return filterGraph(data, { focus: related, visibleBranches: chosen, hideMergedBranches, currentBranch });
    });
  }, [data, focus, onlyRelatedToCurrent, visibleBranches, hideMergedBranches, currentBranch]);

  // Search looks at every changeset, so "Only relevant changesets" can keep what it finds.
  const fullLayout = useMemo(
    () => filtered && rememberedPerHistory(filtered, 'layout', [pending], () => layoutGraph(filtered, undefined, pending)),
    [filtered, pending],
  );
  const searchHits = useSearchHits(fullLayout, search);

  const structure = useMemo(() => {
    if (!filtered || !structureOnly) return null;
    const keep = new Set(expanded);
    if (homeChangeset !== null) keep.add(homeChangeset);
    for (const link of pending?.mergeLinks ?? []) keep.add(link.sourceChangeset);
    for (const hit of searchHits) if (hit.kind === 'changeset') keep.add(hit.id);
    if (revealRequest?.kind === 'changeset') keep.add(revealRequest.id);
    if (revealRequest?.kind === 'label') keep.add(revealRequest.changeset);
    return { keep, pending, layout: layoutGraph(filtered, { keep }, pending) };
  }, [filtered, structureOnly, expanded, homeChangeset, pending, searchHits, revealRequest]);

  // The selection is kept out of the "+N" nodes too.
  const layout = useMemo(
    () => (filtered && structure ? layoutKeeping(filtered, structure, selectedChangeset) : fullLayout),
    [filtered, structure, selectedChangeset, fullLayout],
  );

  return { filtered, fullLayout, layout, searchHits };
}
