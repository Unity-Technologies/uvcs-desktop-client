import { diffArrays } from 'diff';

/** A run of an edit script: lines kept in both texts, removed from the old one, or added in the new one. */
export interface EditRun {
  count: number;
  added: boolean;
  removed: boolean;
}

/**
 * About how many line comparisons a diff may spend on Myers' algorithm, some 100 ms. Myers takes the lines of both
 * texts times the lines changed: a 20,000-line file rewritten took 40 s, and 100,000 lines with every seventh one
 * changed several minutes, all of it frozen.
 */
export const MYERS_BUDGET = 4_000_000;

/** How deep the texts between matched lines are split again; each level reads every line once. */
const MAX_DEPTH = 16;

/**
 * The edit script between two texts given as line ids (equal ids, equal lines). Myers' algorithm (`diff`'s, the diff
 * every text got until now) while it fits in the budget; past it, the lines that occur once in each text and keep their
 * order anchor the texts (patience diff), and what's between two anchors is diffed on its own, by Myers while the
 * budget lasts, or as removed and added whole when nothing in it matches or nothing is left. So a much-changed text
 * takes linear time, and one with few changes gets the same diff as ever.
 */
export function boundedDiff(oldIds: readonly number[], newIds: readonly number[], budget = MYERS_BUDGET): EditRun[] {
  const differ = new BoundedDiffer(oldIds, newIds, budget);
  const whole = differ.myers(0, oldIds.length, 0, newIds.length);
  if (whole) return whole;
  differ.solve(0, oldIds.length, 0, newIds.length, 0);
  return differ.runs;
}

class BoundedDiffer {
  readonly runs: EditRun[] = [];
  private budget: number;
  private readonly oldCount: Int32Array;
  private readonly newCount: Int32Array;
  private readonly newIndex: Int32Array;

  constructor(
    private readonly oldIds: readonly number[],
    private readonly newIds: readonly number[],
    budget: number,
  ) {
    this.budget = budget;
    let ids = 0;
    for (const id of oldIds) ids = Math.max(ids, id + 1);
    for (const id of newIds) ids = Math.max(ids, id + 1);
    this.oldCount = new Int32Array(ids);
    this.newCount = new Int32Array(ids);
    this.newIndex = new Int32Array(ids);
  }

  /** Myers' edit script of the lines in range, or undefined when it needs more edits than the budget affords. */
  myers(oldStart: number, oldEnd: number, newStart: number, newEnd: number): EditRun[] | undefined {
    const lines = oldEnd - oldStart + newEnd - newStart;
    const maxEditLength = Math.min(lines, Math.floor(this.budget / Math.max(lines, 1)));
    const changes = diffArrays(this.oldIds.slice(oldStart, oldEnd), this.newIds.slice(newStart, newEnd), { maxEditLength });
    if (!changes) {
      this.budget -= lines * maxEditLength;
      return undefined;
    }
    let edits = 0;
    for (const change of changes) if (change.added || change.removed) edits += change.count ?? 0;
    this.budget -= lines * edits;
    return changes.map(({ count, added, removed }) => ({ count: count ?? 0, added, removed }));
  }

  solve(oldStart: number, oldEnd: number, newStart: number, newEnd: number, depth: number): void {
    const { oldIds, newIds } = this;
    let prefix = 0;
    while (oldStart + prefix < oldEnd && newStart + prefix < newEnd && oldIds[oldStart + prefix] === newIds[newStart + prefix]) prefix++;
    this.push(prefix, false, false);
    oldStart += prefix;
    newStart += prefix;
    let suffix = 0;
    while (oldEnd - suffix > oldStart && newEnd - suffix > newStart && oldIds[oldEnd - suffix - 1] === newIds[newEnd - suffix - 1]) suffix++;
    oldEnd -= suffix;
    newEnd -= suffix;
    this.between(oldStart, oldEnd, newStart, newEnd, depth);
    this.push(suffix, false, false);
  }

  /** Lines in range that start and end with a difference, when there are any. */
  private between(oldStart: number, oldEnd: number, newStart: number, newEnd: number, depth: number): void {
    if (oldStart === oldEnd || newStart === newEnd) return this.replace(oldEnd - oldStart, newEnd - newStart);
    const anchors = depth < MAX_DEPTH ? this.anchors(oldStart, oldEnd, newStart, newEnd) : null;
    if (anchors === 'disjoint') return this.replace(oldEnd - oldStart, newEnd - newStart);
    if (anchors && anchors.length > 0) {
      for (let index = 0; index < anchors.length; index += 2) {
        const [oldAnchor, newAnchor] = [anchors[index]!, anchors[index + 1]!];
        this.solve(oldStart, oldAnchor, newStart, newAnchor, depth + 1);
        this.push(1, false, false);
        [oldStart, newStart] = [oldAnchor + 1, newAnchor + 1];
      }
      return this.solve(oldStart, oldEnd, newStart, newEnd, depth + 1);
    }
    const script = this.myers(oldStart, oldEnd, newStart, newEnd);
    if (!script) return this.replace(oldEnd - oldStart, newEnd - newStart);
    for (const run of script) this.push(run.count, run.added, run.removed);
  }

  /**
   * The lines in range that occur once in each text, as pairs of indexes (old, new) in a flat array, in the longest
   * run that keeps their order; 'disjoint' when no line of one text is in the other.
   */
  private anchors(oldStart: number, oldEnd: number, newStart: number, newEnd: number): number[] | 'disjoint' {
    const { oldIds, newIds, oldCount, newCount, newIndex } = this;
    for (let index = newStart; index < newEnd; index++) {
      const id = newIds[index]!;
      newCount[id]!++;
      newIndex[id] = index;
    }
    let shared = false;
    const candidates: number[] = [];
    for (let index = oldStart; index < oldEnd; index++) oldCount[oldIds[index]!]!++;
    for (let index = oldStart; index < oldEnd; index++) {
      const id = oldIds[index]!;
      if (newCount[id] === 0) continue;
      shared = true;
      if (oldCount[id] === 1 && newCount[id] === 1) candidates.push(index, newIndex[id]!);
    }
    for (let index = newStart; index < newEnd; index++) newCount[newIds[index]!] = 0;
    for (let index = oldStart; index < oldEnd; index++) oldCount[oldIds[index]!] = 0;
    return shared ? longestIncreasingPairs(candidates) : 'disjoint';
  }

  private replace(removed: number, added: number): void {
    this.push(removed, false, true);
    this.push(added, true, false);
  }

  private push(count: number, added: boolean, removed: boolean): void {
    if (count === 0) return;
    const last = this.runs.at(-1);
    if (last && last.added === added && last.removed === removed) last.count += count;
    else this.runs.push({ count, added, removed });
  }
}

/** Of (old, new) index pairs in a flat array, ordered by old index, the longest subsequence also ordered by new index. */
export function longestIncreasingPairs(pairs: readonly number[]): number[] {
  const count = pairs.length / 2;
  // tails[k]: the pair ending the best subsequence of length k + 1 found so far; previous[i]: the pair before pair i.
  const tails: number[] = [];
  const previous = new Int32Array(count);
  for (let pair = 0; pair < count; pair++) {
    const value = pairs[pair * 2 + 1]!;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (pairs[tails[middle]! * 2 + 1]! < value) low = middle + 1;
      else high = middle;
    }
    previous[pair] = low > 0 ? tails[low - 1]! : -1;
    tails[low] = pair;
  }
  const result = new Array<number>(tails.length * 2);
  for (let pair = tails.at(-1) ?? -1, at = tails.length - 1; pair >= 0; pair = previous[pair]!, at--) {
    result[at * 2] = pairs[pair * 2]!;
    result[at * 2 + 1] = pairs[pair * 2 + 1]!;
  }
  return result;
}
