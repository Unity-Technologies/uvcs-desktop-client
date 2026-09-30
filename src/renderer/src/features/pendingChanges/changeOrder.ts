import type { PendingChange } from '@shared/domain/pendingChanges';
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

/**
 * Folder by folder, so everything in a folder comes right after it: comparing whole paths puts "a-b.txt" between "a"
 * and "a/c.txt", and "src/b" between "Src/a" and "Src/c".
 */
export function comparePaths(a: string, b: string): number {
  // Up to the first character they differ in, the folders are the same: only the names there are compared.
  let differ = 0;
  const shorter = Math.min(a.length, b.length);
  while (differ < shorter && a.charCodeAt(differ) === b.charCodeAt(differ)) differ++;
  if (differ === a.length && differ === b.length) return 0;
  const start = a.lastIndexOf('/', differ - 1) + 1;
  const order = collator.compare(segmentAt(a, start), segmentAt(b, start));
  // Names the collator takes as equal (other Unicode forms of the same text) leave it to the rest of the paths.
  return order !== 0 ? order : compareSegments(a.split('/'), b.split('/'));
}

function segmentAt(path: string, start: number): string {
  const end = path.indexOf('/', start);
  return path.slice(start, end === -1 ? undefined : end);
}

function compareSegments(a: string[], b: string[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const order = collator.compare(a[index]!, b[index]!);
    if (order !== 0) return order;
  }
  return a.length - b.length;
}

/** `localeCompare`'s order, many times faster over thousands of paths. */
const collator = new Intl.Collator();

function sortByPath(changes: PendingChange[]): PendingChange[] {
  return [...changes].sort((a, b) => comparePaths(a.path, b.path));
}
