/**
 * The rows a virtualized list renders (`rangeExtractor`'s indexes, in order) plus `kept`: a row holding the focus
 * stays rendered while scrolled out of view, so the focus isn't lost to the document when it would unmount.
 */
export function keepRendered(indexes: readonly number[], kept: number | null, count: number): number[] {
  if (kept === null || kept < 0 || kept >= count || indexes.includes(kept)) return [...indexes];
  const at = indexes.findIndex((index) => index > kept);
  return at === -1 ? [...indexes, kept] : [...indexes.slice(0, at), kept, ...indexes.slice(at)];
}
