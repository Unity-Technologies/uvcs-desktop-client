/**
 * How many hints of a line keep their place (`KeyHints`' `oneLine`): as many as fit, in their order of priority, `gap`
 * apart, the last dropped first rather than wrap the line. Null `available` (not measured yet) keeps them all.
 */
export function hintsThatFit(widths: readonly number[], gap: number, available: number | null): number {
  if (available === null) return widths.length;
  let used = 0;
  for (const [index, width] of widths.entries()) {
    used += (index > 0 ? gap : 0) + width;
    if (used > available) return index;
  }
  return widths.length;
}
