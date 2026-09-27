import type { PendingChange, PendingChangesSnapshot } from '@shared/domain/pendingChanges';

/**
 * The query's structural sharing for pending changes: a read that finds a change as it was keeps the object already
 * shown, and a read that finds everything as it was keeps the whole snapshot, so nothing worked out from them is worked
 * out again. TanStack's own comparison goes over every field generically, 90 ms for 100,000 changes; this goes by path.
 */
export function sharePendingChanges(previous: PendingChangesSnapshot | undefined, next: PendingChangesSnapshot): PendingChangesSnapshot {
  if (!previous) return next;
  let byPath: Map<string, PendingChange> | null = null;
  let sameChanges = previous.changes.length === next.changes.length;
  const changes = next.changes.map((change, index) => {
    // `cm` lists them in the same order read after read: the one at the same place is almost always the one.
    let before: PendingChange | undefined = previous.changes[index];
    if (before?.path !== change.path) {
      byPath ??= new Map(previous.changes.map((candidate) => [candidate.path, candidate]));
      before = byPath.get(change.path);
      sameChanges = false;
    }
    if (before && sameFields(before, change)) return before;
    sameChanges = false;
    return change;
  });
  const sameChangelists = previous.changelists.length === next.changelists.length && next.changelists.every((changelist, index) => sameFields(previous.changelists[index]!, changelist));
  if (sameChanges && sameChangelists && previous.loadedChangeset === next.loadedChangeset) return previous;
  return { ...next, changes: sameChanges ? previous.changes : changes, changelists: sameChangelists ? previous.changelists : next.changelists };
}

/** Plain values, or arrays of them (a change's kinds), field by field. */
function sameFields<T extends object>(a: T, b: T): boolean {
  let fields = 0;
  for (const key in a) {
    fields++;
    const [valueA, valueB] = [a[key], b[key]];
    if (valueA === valueB) continue;
    if (!Array.isArray(valueA) || !Array.isArray(valueB) || valueA.length !== valueB.length || valueA.some((item, index) => item !== valueB[index])) return false;
  }
  return fields === Object.keys(b).length;
}
