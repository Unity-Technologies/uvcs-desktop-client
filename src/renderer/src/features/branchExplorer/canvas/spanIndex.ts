/**
 * Finds which of many horizontal spans overlap a range without looking at them all: a frame draws only the lanes and
 * links crossing the screen, out of tens of thousands. Built once per layout; the spans are sorted by their left end
 * and a tree keeps the rightmost end of each run of them, so whole runs ending before the range are skipped.
 */
export class SpanIndex {
  /** Item indexes in order of their left end. */
  private readonly order: Int32Array;
  private readonly lefts: Float64Array;
  /** `rights[order[i]]` of the sorted spans, as a max tree: leaves at `size + i`, each node the max of its two children. */
  private readonly maxRight: Float64Array;
  private readonly size: number;

  constructor(lefts: readonly number[], rights: readonly number[]) {
    const count = lefts.length;
    this.order = Int32Array.from({ length: count }, (_, index) => index).sort((a, b) => lefts[a]! - lefts[b]!);
    this.lefts = Float64Array.from(this.order, (index) => lefts[index]!);
    let size = 1;
    while (size < count) size *= 2;
    this.size = size;
    this.maxRight = new Float64Array(size * 2).fill(Number.NEGATIVE_INFINITY);
    this.order.forEach((item, position) => (this.maxRight[size + position] = rights[item]!));
    for (let node = size - 1; node >= 1; node--) this.maxRight[node] = Math.max(this.maxRight[node * 2]!, this.maxRight[node * 2 + 1]!);
  }

  /** Fills `found` with the indexes of the spans reaching into [left, right], in ascending index order (drawing order). */
  overlapping(left: number, right: number, found: number[]): number[] {
    found.length = 0;
    // Only spans starting at or before `right` can reach into the range: a prefix of the sorted spans.
    let low = 0;
    let high = this.lefts.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.lefts[middle]! <= right) low = middle + 1;
      else high = middle;
    }
    if (low > 0) this.collect(1, 0, this.size, low, left, found);
    return found.sort((a, b) => a - b);
  }

  /** The spans among sorted positions [0, end) under `node` (covering [from, to)) whose right end reaches `left`. */
  private collect(node: number, from: number, to: number, end: number, left: number, found: number[]): void {
    if (from >= end || this.maxRight[node]! < left) return;
    if (to - from === 1) {
      found.push(this.order[from]!);
      return;
    }
    const middle = (from + to) >>> 1;
    this.collect(node * 2, from, middle, end, left, found);
    this.collect(node * 2 + 1, middle, to, end, left, found);
  }
}
