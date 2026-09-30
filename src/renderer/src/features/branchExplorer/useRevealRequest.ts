import { useEffect, useRef } from 'react';
import { toast } from '../../ui/toast/toastStore';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import type { GraphLayout } from './model/layoutGraph';
import { describeRevealTarget, revealStep, type RevealHit } from './model/revealTarget';

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
 * branches), and only says it is not there when nothing is left to relax (`revealStep`).
 */
export function useRevealRequest({ layout, settled, filtersActive, clearFilters, reveal }: RevealRequestOptions): void {
  const { revealRequest, dateRange, showHiddenBranches, set } = useBranchExplorerPreferences();
  const latest = useRef({ clearFilters, reveal });
  latest.current = { clearFilters, reveal };

  useEffect(() => {
    if (!revealRequest || !layout || !settled) return;
    const step = revealStep(revealRequest, layout, { filtersActive, dateRange, showHiddenBranches });
    switch (step.kind) {
      case 'reveal':
        set({ revealRequest: null });
        latest.current.reveal(step.hit);
        break;
      case 'notInGraph':
        set({ revealRequest: null });
        toast.info(`${describeRevealTarget(revealRequest)} is not in the Branch Explorer`, 'Not even with every filter off and all history loaded.');
        break;
      case 'clearFilters':
        latest.current.clearFilters();
        break;
      case 'widenDates':
        set({ dateRange: step.dateRange });
        break;
      case 'showHidden':
        set({ showHiddenBranches: true });
        break;
    }
  }, [revealRequest, layout, settled, filtersActive, dateRange, showHiddenBranches, set]);
}
