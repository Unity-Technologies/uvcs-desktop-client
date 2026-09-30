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
 * changed, for walking a change that touched several places; null past the ends.
 */
export function adjacentBlock(blocks: readonly AnnotationBlock[], from: number, direction: 1 | -1, sameChangeset = false): number | null {
  const changesetId = blocks[from]!.changeset.changesetId;
  for (let index = from + direction; index >= 0 && index < blocks.length; index += direction) {
    if (!sameChangeset || blocks[index]!.changeset.changesetId === changesetId) return index;
  }
  return null;
}

/**
 * The block a walking key goes to: from the picked block, the one after or before it (of the same changeset with
 * `sameChangeset`); with none picked, the block at the top of the view (`topLine`), whichever the key.
 */
export function walkedBlock(blocks: readonly AnnotationBlock[], picked: number, direction: 1 | -1, sameChangeset: boolean, topLine: number): number | null {
  if (picked !== -1) return adjacentBlock(blocks, picked, direction, sameChangeset);
  return blocks.length > 0 ? blockAt(blocks, topLine) : null;
}

/** How many other blocks the changeset of block `index` changed: the places the card and the highlight point to. */
export function otherBlocksOfChangeset(blocks: readonly AnnotationBlock[], index: number): number {
  const changesetId = blocks[index]?.changeset.changesetId;
  if (changesetId === undefined) return 0;
  return blocks.reduce((count, block, other) => (other !== index && block.changeset.changesetId === changesetId ? count + 1 : count), 0);
}

/**
 * The changeset whose lines stand out when block `picked` is picked: its own, when it changed other blocks too (a
 * changeset of one block has nothing to point out). Null when nothing is picked.
 */
export function highlightedChangeset(blocks: readonly AnnotationBlock[], picked: number): number | null {
  return otherBlocksOfChangeset(blocks, picked) > 0 ? blocks[picked]!.changeset.changesetId : null;
}

/** How many people changed the lines of the file. */
export function distinctAuthors({ changesets }: Annotation): number {
  return new Set(changesets.map((changeset) => changeset.owner)).size;
}
