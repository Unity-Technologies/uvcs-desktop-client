import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { placeId, type Place } from '@shared/domain/place';

/** The page windows opening at once, at most: an older hand-over nobody took (its window failed to load) goes. */
const MAX_WAITING = 4;

/**
 * The diffs a window hands to the page window it opens (`windows.openPage`): what it already read with `cm diff`, which
 * the page window's first read of that diff (`diff.entries`) takes instead of running `cm diff` again. Each one is
 * taken once; the page window keeps it from then on, as any diff it read.
 */
export class HandedOverDiffs {
  private readonly waiting = new Map<string, DiffEntry[]>();

  hand(place: Place, target: DiffTarget, entries: DiffEntry[]): void {
    const key = keyOf(place, target);
    this.waiting.delete(key);
    this.waiting.set(key, entries);
    if (this.waiting.size > MAX_WAITING) this.waiting.delete(this.waiting.keys().next().value!);
  }

  /** The entries handed over for this diff, once; undefined when none were (read it with `cm diff`). */
  take(place: Place, target: DiffTarget): DiffEntry[] | undefined {
    const key = keyOf(place, target);
    const entries = this.waiting.get(key);
    this.waiting.delete(key);
    return entries;
  }
}

/** A target's fields in one order, whatever order the page wrote them in. */
function keyOf(place: Place, target: DiffTarget): string {
  const fields = Object.entries(target).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([placeId(place), fields]);
}
