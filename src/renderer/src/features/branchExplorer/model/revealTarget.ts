import { longerPresets, sinceDateFor, type SincePreset } from '../../../lib/sincePresets';
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
  dateRange: SincePreset;
  showHiddenBranches: boolean;
}

/** One step towards showing a target the graph hides, from the least to the most disruptive. */
export type RevealRelaxation = { kind: 'clearFilters' } | { kind: 'widenDates'; dateRange: SincePreset } | { kind: 'showHidden' };

/** The next thing to relax while a target is not in the graph; null once nothing is left to relax. */
export function nextRelaxation(limits: RevealLimits, targetDate: string | undefined, now = new Date()): RevealRelaxation | null {
  if (limits.filtersActive) return { kind: 'clearFilters' };
  if (limits.dateRange !== 'anyTime') return { kind: 'widenDates', dateRange: rangeIncluding(targetDate, limits.dateRange, now) };
  if (!limits.showHiddenBranches) return { kind: 'showHidden' };
  return null;
}

/** What a reveal does once the graph settled: show what it found, relax one limit and look again, or give up. */
export type RevealStep = { kind: 'reveal'; hit: RevealHit } | RevealRelaxation | { kind: 'notInGraph' };

export function revealStep(target: RevealTarget, layout: GraphLayout, limits: RevealLimits, now = new Date()): RevealStep {
  const hit = resolveReveal(target, layout);
  if (hit) return { kind: 'reveal', hit };
  return nextRelaxation(limits, target.date, now) ?? { kind: 'notInGraph' };
}

/** "Changeset 12", "Branch /main/task", "Label v1.0". */
export function describeRevealTarget(target: RevealTarget): string {
  switch (target.kind) {
    case 'changeset':
      return `Changeset ${target.id}`;
    case 'branch':
      return `Branch ${target.name}`;
    case 'label':
      return `Label ${target.name}`;
  }
}

/** The shortest range longer than `current` that reaches back to `date`; all history when the date is unknown. */
function rangeIncluding(date: string | undefined, current: SincePreset, now: Date): SincePreset {
  if (!date) return 'anyTime';
  const day = date.slice(0, 10);
  return longerPresets(current).find((preset) => (sinceDateFor(preset, now) ?? '') <= day) ?? 'anyTime';
}
