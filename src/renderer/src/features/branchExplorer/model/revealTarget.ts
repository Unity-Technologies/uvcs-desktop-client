import { DATE_RANGES, sinceDateFor, type DateRangeId } from './dateRanges';
import type { GraphLayout } from './layoutGraph';

/**
 * Something to show in the Branch Explorer from another view. `date` (when the object was made)
 * lets a reveal widen the date range just enough instead of loading all history.
 */
export type RevealTarget =
  | { kind: 'changeset'; id: number; date?: string }
  | { kind: 'branch'; name: string; date?: string }
  | { kind: 'label'; name: string; changeset: number; date?: string };

/** Where a target is in the graph: labels land on their changeset. */
export type RevealHit = { kind: 'changeset'; id: number } | { kind: 'branch'; name: string };

export function resolveReveal(target: RevealTarget, layout: GraphLayout): RevealHit | null {
  switch (target.kind) {
    case 'changeset':
      return layout.nodes.has(target.id) ? { kind: 'changeset', id: target.id } : null;
    case 'branch':
      return layout.lanesByBranch.has(target.name) ? { kind: 'branch', name: target.name } : null;
    case 'label':
      return layout.labelsByChangeset.get(target.changeset)?.some((label) => label.name === target.name) ? { kind: 'changeset', id: target.changeset } : null;
  }
}

/** What currently limits the graph, as far as a reveal is concerned. */
export interface RevealLimits {
  /** A focus, "only related to mine", "hide merged", unchecked branches or an author. */
  filtersActive: boolean;
  dateRange: DateRangeId;
  showHiddenBranches: boolean;
}

/** One step towards showing a target the graph hides, from the least to the most disruptive. */
export type RevealRelaxation = { kind: 'clearFilters' } | { kind: 'widenDates'; dateRange: DateRangeId } | { kind: 'showHidden' };

/** The next thing to relax while a target is not in the graph; null once nothing is left to relax. */
export function nextRelaxation(limits: RevealLimits, targetDate: string | undefined, now = new Date()): RevealRelaxation | null {
  if (limits.filtersActive) return { kind: 'clearFilters' };
  if (limits.dateRange !== 'all') return { kind: 'widenDates', dateRange: rangeIncluding(targetDate, limits.dateRange, now) };
  if (!limits.showHiddenBranches) return { kind: 'showHidden' };
  return null;
}

/** The shortest range longer than `current` that reaches back to `date`; all history when the date is unknown. */
function rangeIncluding(date: string | undefined, current: DateRangeId, now: Date): DateRangeId {
  if (!date) return 'all';
  const day = date.slice(0, 10);
  const longer = DATE_RANGES.slice(DATE_RANGES.findIndex((range) => range.id === current) + 1);
  return longer.find((range) => (sinceDateFor(range.id, now) ?? '') <= day)?.id ?? 'all';
}
