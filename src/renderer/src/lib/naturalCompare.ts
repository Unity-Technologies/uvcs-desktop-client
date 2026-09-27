const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Orders names as people read them: `task-2` before `task-10`, and `Zeta` after `alpha`. */
export function naturalCompare(a: string, b: string): number {
  return collator.compare(a, b);
}

/** Orders the values a table sorts by: text as people read it, numbers by value. */
export function compareSortValues(a: string | number, b: string | number): number {
  if (typeof a === 'string' && typeof b === 'string') return naturalCompare(a, b);
  return a < b ? -1 : a > b ? 1 : 0;
}
