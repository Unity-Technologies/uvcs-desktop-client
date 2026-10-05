import { diffArrays } from 'diff';
import { listChangeBlocks, type ChangeBlock, type ChangedLine, type DisplayMeta } from './changeBlocks';
import { comparedPart, type ComparisonMethod } from './comparisonMethod';

/** Lines of one file, numbered from 1. */
export interface LineRange {
  start: number;
  count: number;
}

/** Code the diff shows removed in one place and added in another: moved, maybe edited on the way. */
export interface MovedBlock {
  /** Where it was, in the original. */
  deletions: LineRange;
  /** Where it is, in the modified file. */
  additions: LineRange;
  /** Its lines that differ between the two places; the rest moved as they were. */
  changed: ChangedLine[];
}

/** How alike two blocks must be to be one block moved: 80% of their words the same, as the official client's default. */
export const MOVED_SIMILARITY = 0.8;
/** A single line is too common to tell a move from a coincidence. */
export const MIN_MOVED_LINES = 2;
/**
 * Past this many changes or changed lines, a diff is a rewrite more than a reorder, and looking for moves (every block
 * against every other) would cost more than it tells: the official client's limits.
 */
export const MAX_BLOCKS = 50;
export const MAX_CHANGED_LINES = 500;
/** At most this many block comparisons in a diff, however its blocks fall: some 50 ms at worst. */
export const MAX_COMPARISONS = 20_000;
/** A block moved into a bigger change is searched for in runs of that change's lines, up to this many more than its own. */
const EXTRA_WINDOW_LINES = 10;

/**
 * The blocks a diff (`lineDiff`) removed in one place and added in another, compared under `method` as the diff was.
 * A side of a change (its removed or its added lines) is a move when another change's other side, or a run of its
 * lines, has at least `MOVED_SIMILARITY` of its words, counted by edit distance: so a block moved and edited a bit is
 * still a move. A change whose sides are that alike is an edit in place, never a move. Each line is in one move at
 * most: the closest match wins.
 */
export function detectMovedBlocks(meta: DisplayMeta, method: ComparisonMethod): MovedBlock[] {
  const blocks = listChangeBlocks(meta);
  const changedLines = blocks.reduce((total, block) => total + block.oldLines + block.newLines, 0);
  if (blocks.length > MAX_BLOCKS || changedLines > MAX_CHANGED_LINES) return [];
  const search = new MoveSearch(meta, method, blocks);
  const candidates = search.sides.flatMap((sides) => search.movesFrom(sides));
  return closestFirst(candidates).map(({ deletions, additions }) => ({ deletions, additions, changed: changedInMove(meta, method, deletions, additions) }));
}

/** A side of a change, its lines as word ids. */
interface Side {
  range: LineRange;
  lines: number[][];
  /** Words before each line, and in all of them at the end. */
  wordsBefore: number[];
  /** Whether it holds a name or a number: lines of braces and blanks are alike everywhere. */
  named: boolean;
}

/** A change's two sides. */
interface BlockSides {
  removed: Side;
  added: Side;
}

interface Candidate {
  deletions: LineRange;
  additions: LineRange;
  edits: number;
}

/** Comparisons of blocks by their words; exported for tests that count its work (`compare`). */
export class MoveSearch {
  /** Each change's sides, in the diff's order. */
  readonly sides: BlockSides[];
  private readonly wordIds = new Map<string, number>();
  private comparisonsLeft = MAX_COMPARISONS;

  constructor(
    private readonly meta: DisplayMeta,
    private readonly method: ComparisonMethod,
    blocks: ChangeBlock[],
  ) {
    this.sides = blocks.map((block) => ({ removed: this.side('deletions', block.oldStart, block.oldLines), added: this.side('additions', block.newStart, block.newLines) }));
  }

  /** Where each side of a change went, if it moved: the closest match among the other changes' opposite sides. */
  movesFrom(change: BlockSides): Candidate[] {
    const { removed, added } = change;
    if (removed.range.count > 0 && added.range.count > 0 && this.compare(removed, added, allowedEdits(removed)) >= 0) return [];
    const others = this.sides.filter((other) => other !== change);
    const wentTo = this.closest(removed, others.map((other) => other.added));
    const cameFrom = this.closest(added, others.map((other) => other.removed));
    return [
      ...(wentTo ? [{ deletions: removed.range, additions: wentTo.range, edits: wentTo.edits }] : []),
      ...(cameFrom ? [{ deletions: cameFrom.range, additions: added.range, edits: cameFrom.edits }] : []),
    ];
  }

  /**
   * The edit distance between two sides' words, when it's at most `maxEdits` (a word changed counts two: one out, one
   * in); -1 past it, or once the diff has spent its comparisons.
   */
  compare(source: Side, target: Side, maxEdits: number, targetStart = 0, targetCount = target.lines.length): number {
    const targetWords = target.wordsBefore[targetStart + targetCount]! - target.wordsBefore[targetStart]!;
    if (maxEdits < 0 || Math.abs(totalWords(source) - targetWords) > maxEdits || this.comparisonsLeft <= 0) return -1;
    this.comparisonsLeft--;
    const changes = diffArrays(source.lines.flat(), target.lines.slice(targetStart, targetStart + targetCount).flat(), { maxEditLength: maxEdits });
    if (!changes) return -1;
    return changes.reduce((edits, change) => edits + (change.added || change.removed ? (change.count ?? 0) : 0), 0);
  }

  /** The closest match for `source` among the targets, whole or a run of their lines, if any is close enough. */
  private closest(source: Side, targets: Side[]): { range: LineRange; edits: number } | undefined {
    if (source.range.count < MIN_MOVED_LINES || !source.named) return undefined;
    let best: { range: LineRange; edits: number } | undefined;
    let maxEdits = allowedEdits(source);
    for (const target of targets) {
      if (target.range.count < source.range.count) continue;
      for (const [start, count] of windows(source.range.count, target.range.count)) {
        const edits = this.compare(source, target, maxEdits, start, count);
        if (edits < 0) continue;
        best = { range: { start: target.range.start + start, count }, edits };
        if (edits === 0) return best;
        maxEdits = edits - 1;
      }
    }
    return best;
  }

  private side(side: ChangedLine['side'], start: number, count: number): Side {
    const texts = side === 'deletions' ? this.meta.deletionLines : this.meta.additionLines;
    const compared = texts.slice(start - 1, start - 1 + count).map((text) => comparedPart(text, this.method));
    const lines = compared.map((text) => this.words(text));
    const wordsBefore = [0];
    for (const line of lines) wordsBefore.push(wordsBefore.at(-1)! + line.length);
    return { range: { start, count }, lines, wordsBefore, named: compared.some((text) => NAME.test(text)) };
  }

  private words(line: string): number[] {
    return (line.match(WORD) ?? []).map((word) => {
      let id = this.wordIds.get(word);
      if (id === undefined) this.wordIds.set(word, (id = this.wordIds.size));
      return id;
    });
  }
}

/** A run of letters, digits or underscores (any script's), a run of spaces and tabs, a line break, or one other character. */
const WORD = /[\p{L}\p{N}_]+|[ \t]+|\r\n|[\s\S]/gu;
const NAME = /[\p{L}\p{N}]/u;

function totalWords(side: Side): number {
  return side.wordsBefore.at(-1)!;
}

function allowedEdits(side: Side): number {
  return Math.floor(totalWords(side) * (1 - MOVED_SIMILARITY));
}

/**
 * The runs of a target's lines to try a source of `size` lines against: the whole target first, then runs of the
 * source's size and up to `EXTRA_WINDOW_LINES` more, at every place (the comparison skips at once the ones whose word
 * counts are too far apart).
 */
function* windows(size: number, targetSize: number): Generator<[start: number, count: number]> {
  yield [0, targetSize];
  for (let count = size; count < targetSize && count <= size + EXTRA_WINDOW_LINES; count++) {
    for (let start = 0; start + count <= targetSize; start++) yield [start, count];
  }
}

/** The candidates, closest first and bigger first among equals, each kept only when its lines are in no move kept before. */
function closestFirst(candidates: Candidate[]): Candidate[] {
  const ordered = [...candidates].sort((a, b) => a.edits - b.edits || b.deletions.count + b.additions.count - (a.deletions.count + a.additions.count) || a.deletions.start - b.deletions.start);
  const kept: Candidate[] = [];
  for (const candidate of ordered) {
    if (kept.some((move) => overlaps(move.deletions, candidate.deletions) || overlaps(move.additions, candidate.additions))) continue;
    kept.push(candidate);
  }
  return kept.sort((a, b) => a.deletions.start - b.deletions.start);
}

function overlaps(a: LineRange, b: LineRange): boolean {
  return a.start < b.start + b.count && b.start < a.start + a.count;
}

/** The lines of a move that differ between its two places, by a line diff of its two copies under `method`. */
function changedInMove(meta: DisplayMeta, method: ComparisonMethod, deletions: LineRange, additions: LineRange): ChangedLine[] {
  const key = (line: string): string => comparedPart(line, method);
  const before = meta.deletionLines.slice(deletions.start - 1, deletions.start - 1 + deletions.count).map(key);
  const after = meta.additionLines.slice(additions.start - 1, additions.start - 1 + additions.count).map(key);
  const changed: ChangedLine[] = [];
  let oldLine = deletions.start;
  let newLine = additions.start;
  for (const change of diffArrays(before, after)) {
    const count = change.count ?? 0;
    for (let offset = 0; offset < count; offset++) {
      if (change.removed) changed.push({ side: 'deletions', lineNumber: oldLine + offset });
      if (change.added) changed.push({ side: 'additions', lineNumber: newLine + offset });
    }
    if (!change.added) oldLine += count;
    if (!change.removed) newLine += count;
  }
  return changed;
}
