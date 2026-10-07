import type { PendingChange } from '@shared/domain/pendingChanges';
import { comparePaths } from '@shared/pathOrder';
import { compareTones } from '../../components/changeFilter';
import type { ChangesLayout } from './changeRows';
import { changeTone } from './changeTone';

/**
 * The order the rows show changes in. Sorting what is already in order takes one comparison a change, so a view that
 * hands `layoutChangeRows` changes kept in this order (filtered, but not reordered) lays them out again without sorting.
 */
export function sortForLayout(changes: PendingChange[], layout: ChangesLayout): PendingChange[] {
  return layout === 'tree' ? sortByPath(changes) : sortByStatus(changes);
}

/**
 * `changes` with those also in `previous` (the very objects: a read keeps the changes it found as they were) in the
 * order `previous` had them, then the others. A read that changed a few changes of a sorted list gives a list nearly
 * in order, which sorting goes through in about one comparison a change.
 */
export function inPreviousOrder(changes: PendingChange[], previous: PendingChange[]): PendingChange[] {
  const current = new Set(changes);
  const kept = previous.filter((change) => current.has(change));
  if (kept.length === changes.length) return kept;
  const keptSet = new Set(kept);
  return [...kept, ...changes.filter((change) => !keptSet.has(change))];
}

/** A flat list reads by kind of change first, in the order of the filter chips; a tree has to follow the folders. */
export function sortByStatus(changes: PendingChange[]): PendingChange[] {
  // Each change's status once, not twice a comparison: tens of thousands of changes take a million comparisons.
  const withTones = changes.map((change) => ({ change, tone: changeTone(change) }));
  withTones.sort((a, b) => compareTones(a.tone, b.tone) || collator.compare(a.change.path, b.change.path));
  return withTones.map(({ change }) => change);
}

/** `localeCompare`'s order, many times faster over thousands of paths. */
const collator = new Intl.Collator();

function sortByPath(changes: PendingChange[]): PendingChange[] {
  return [...changes].sort((a, b) => comparePaths(a.path, b.path));
}
