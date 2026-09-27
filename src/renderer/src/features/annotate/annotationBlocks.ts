import type { Annotation, AnnotationChangeset } from '@shared/domain/annotate';
import { ageBucket, recencyByChangeset } from './annotationAge';
import type { RowRange } from './visibleRows';

/** A run of consecutive lines last changed by the same changeset: the gutter labels it once, on its first line. */
export interface AnnotationBlock {
  /** First line (0-based). */
  start: number;
  /** One past its last line. */
  end: number;
  changeset: AnnotationChangeset;
  /** Its shade in the age strip, 1 (oldest in the file) to `AGE_BUCKETS` (newest). */
  age: number;
}

/** The file's blocks, in line order. */
export function annotationBlocks({ lines, changesets }: Annotation): AnnotationBlock[] {
  const changesetsById = new Map(changesets.map((changeset) => [changeset.changesetId, changeset]));
  const recency = recencyByChangeset(changesets);
  const blocks: AnnotationBlock[] = [];
  lines.forEach((line, index) => {
    const last = blocks.at(-1);
    if (last && last.changeset.changesetId === line.changesetId) last.end = index + 1;
    else blocks.push({ start: index, end: index + 1, changeset: changesetsById.get(line.changesetId)!, age: ageBucket(recency.get(line.changesetId) ?? 0) });
  });
  return blocks;
}

/** The index of the block holding `line` (clamped to the file), found by halving: files have tens of thousands of blocks. */
export function blockAt(blocks: readonly AnnotationBlock[], line: number): number {
  let low = 0;
  let high = blocks.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (blocks[middle]!.start <= line) low = middle;
    else high = middle - 1;
  }
  return low;
}

/** The blocks with a line among `rows` (the rows in view), as a range of block indexes. */
export function blocksInView(blocks: readonly AnnotationBlock[], rows: RowRange): RowRange {
  if (blocks.length === 0 || rows.end <= rows.first) return { first: 0, end: 0 };
  return { first: blockAt(blocks, rows.first), end: blockAt(blocks, rows.end - 1) + 1 };
}

/**
 * The block after (`direction` 1) or before (-1) block `from`, or with `sameChangeset` the next one the same changeset
 * changed, for walking a change that touched several places; null past the ends. From no block (-1), the first or last.
 */
export function adjacentBlock(blocks: readonly AnnotationBlock[], from: number, direction: 1 | -1, sameChangeset = false): number | null {
  const changesetId = blocks[from]?.changeset.changesetId;
  const start = from === -1 && direction === -1 ? blocks.length : from;
  for (let index = start + direction; index >= 0 && index < blocks.length; index += direction) {
    if (!sameChangeset || changesetId === undefined || blocks[index]!.changeset.changesetId === changesetId) return index;
  }
  return null;
}

export function distinctAuthors({ changesets }: Annotation): number {
  return new Set(changesets.map((changeset) => changeset.owner)).size;
}
