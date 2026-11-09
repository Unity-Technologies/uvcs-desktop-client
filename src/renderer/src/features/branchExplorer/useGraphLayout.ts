import { useMemo } from 'react';
import type { BranchExplorerData } from '@shared/domain/branchExplorer';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import type { BranchPins } from './model/branchRows';
import type { ExplorerRule } from './model/explorerRules';
import { filterGraph, type GraphFocus } from './model/filterGraph';
import { layoutGraph, layoutKeeping, type GraphLayout, type PendingChangeset } from './model/layoutGraph';
import { rememberedPerHistory } from './model/rememberedPerHistory';
import { branchesKeptByRules } from './model/ruleFilter';
import type { RuleMatches } from './model/ruleMatches';
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
  /** The repository's advanced filters and formats, and what the server says their conditions match. */
  rules: readonly ExplorerRule[];
  matches: RuleMatches;
  /** The branches the user moved to other rows. */
  pins: BranchPins;
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
export function useGraphLayout({ data, focus, currentBranch, homeChangeset, pending, expanded, search, selectedChangeset, rules, matches, pins }: GraphLayoutInputs): GraphLayouts {
  const { hideMergedBranches, onlyRelatedToCurrent, visibleBranches, structureOnly, revealRequest } = useBranchExplorerPreferences();

  const filtered = useMemo(() => {
    if (!data) return null;
    const related = focus ?? (onlyRelatedToCurrent && currentBranch ? { branch: currentBranch, hops: 1 } : null);
    return rememberedPerHistory(data, 'filtered', [related?.branch, related?.hops, visibleBranches, hideMergedBranches, currentBranch, rules, matches], () => {
      const chosen = visibleBranches && new Set(visibleBranches);
      const keptByRules = branchesKeptByRules(data, rules, matches);
      return filterGraph(data, { focus: related, visibleBranches: chosen, keptByRules, hideMergedBranches, currentBranch });
    });
  }, [data, focus, onlyRelatedToCurrent, visibleBranches, hideMergedBranches, currentBranch, rules, matches]);

  // Search looks at every changeset, so "Only relevant changesets" can keep what it finds.
  const fullLayout = useMemo(
    () => filtered && rememberedPerHistory(filtered, 'layout', [pending, pins], () => layoutGraph(filtered, undefined, pending, pins)),
    [filtered, pending, pins],
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
    return { keep, pending, pins, layout: layoutGraph(filtered, { keep }, pending, pins) };
  }, [filtered, structureOnly, expanded, homeChangeset, pending, pins, searchHits, revealRequest]);

  // The selection is kept out of the "+N" nodes too.
  const layout = useMemo(
    () => (filtered && structure ? layoutKeeping(filtered, structure, selectedChangeset) : fullLayout),
    [filtered, structure, selectedChangeset, fullLayout],
  );

  return { filtered, fullLayout, layout, searchHits };
}
