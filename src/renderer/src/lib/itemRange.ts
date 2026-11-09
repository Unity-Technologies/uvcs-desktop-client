/**
 * The items of a list from `start` up to `end`: what a folder or a group of a tree of files holds (`layoutPathTree`,
 * `layoutGroupedTree`). In path order, everything under a folder is one run of the list, so a folder points into the
 * list it was laid out from instead of copying it: copies put each file in memory once per folder it sits in. The list
 * is `readonly` because it never changes in place: a range into a list that changed would point at other items.
 */
export interface ItemRange<T> {
  readonly list: readonly T[];
  readonly start: number;
  readonly end: number;
}

/** Every item of `list`: what a group holds. */
export function wholeList<T>(list: readonly T[]): ItemRange<T> {
  return { list, start: 0, end: list.length };
}

/** How many items the range holds. */
export function rangeLength<T>(range: ItemRange<T>): number {
  return range.end - range.start;
}

/**
 * The items of the range, copied: for what acts on them once (a menu, a check, a drag, an operation), never for what
 * is drawn with every row. A folder at the top of a tree can hold a million.
 */
export function itemsIn<T>(range: ItemRange<T>): T[] {
  return range.list.slice(range.start, range.end);
}

/** Calls `visit` with each item of the range, in order, without copying them. */
export function forEachIn<T>(range: ItemRange<T>, visit: (item: T) => void): void {
  for (let index = range.start; index < range.end; index++) visit(range.list[index]!);
}

/** How many items of the range pass `test`, without copying them. */
export function countIn<T>(range: ItemRange<T>, test: (item: T) => boolean): number {
  let count = 0;
  for (let index = range.start; index < range.end; index++) if (test(range.list[index]!)) count++;
  return count;
}

/** Whether some item of the range passes `test`, without copying them. */
export function someIn<T>(range: ItemRange<T>, test: (item: T) => boolean): boolean {
  for (let index = range.start; index < range.end; index++) if (test(range.list[index]!)) return true;
  return false;
}
