/**
 * The rows a virtualized list renders (`rangeExtractor`'s indexes, in order) plus `kept`, which stays rendered while
 * scrolled out of view: the row holding the focus, so the focus isn't lost to the document when it would unmount, or
 * the row a search field's `aria-activedescendant` names, so screen readers always find it.
 */
export function keepRendered(indexes: readonly number[], kept: number | null, count: number): number[] {
  if (kept === null || kept < 0 || kept >= count || indexes.includes(kept)) return [...indexes];
  const at = indexes.findIndex((index) => index > kept);
  return at === -1 ? [...indexes, kept] : [...indexes.slice(0, at), kept, ...indexes.slice(at)];
}
