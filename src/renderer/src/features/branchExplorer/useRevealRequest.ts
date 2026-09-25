import { useEffect, useRef } from 'react';
import { toast } from '../../ui/toast/toastStore';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import type { GraphLayout } from './model/layoutGraph';
import { nextRelaxation, resolveReveal, type RevealHit, type RevealTarget } from './model/revealTarget';

interface RevealRequestOptions {
  layout: GraphLayout | null;
  /** False while history for the current date range is still loading. */
  settled: boolean;
  /** Whether a focus, branch, merged, related or author filter is on. */
  filtersActive: boolean;
  clearFilters: () => void;
  /** Selects and frames what was found. */
  reveal: (hit: RevealHit) => void;
}

/**
 * Handles "Show in Branch Explorer" from other views: once the graph has settled, reveals the target;
 * while the graph hides it, relaxes the filters one step at a time (filters, then dates, then hidden
 * branches), and only says it is not there when nothing is left to relax.
 */
export function useRevealRequest({ layout, settled, filtersActive, clearFilters, reveal }: RevealRequestOptions): void {
  const { revealRequest, dateRange, showHiddenBranches, set } = useBranchExplorerPreferences();
  const latest = useRef({ clearFilters, reveal });
  latest.current = { clearFilters, reveal };

  useEffect(() => {
    if (!revealRequest || !layout || !settled) return;
    const hit = resolveReveal(revealRequest, layout);
    const relaxation = hit ? null : nextRelaxation({ filtersActive, dateRange, showHiddenBranches }, revealRequest.date);
    if (hit || !relaxation) set({ revealRequest: null });

    if (hit) latest.current.reveal(hit);
    else if (!relaxation) toast.info(`${describe(revealRequest)} is not in the Branch Explorer`, 'Not even with every filter off and all history loaded.');
    else if (relaxation.kind === 'clearFilters') latest.current.clearFilters();
    else if (relaxation.kind === 'widenDates') set({ dateRange: relaxation.dateRange });
    else set({ showHiddenBranches: true });
  }, [revealRequest, layout, settled, filtersActive, dateRange, showHiddenBranches, set]);
}

function describe(target: RevealTarget): string {
  switch (target.kind) {
    case 'changeset':
      return `Changeset ${target.id}`;
    case 'branch':
      return `Branch ${target.name}`;
    case 'label':
      return `Label ${target.name}`;
  }
}
