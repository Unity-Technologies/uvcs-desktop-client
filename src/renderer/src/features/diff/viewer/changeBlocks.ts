/**
 * Change blocks of a text diff: each contiguous run of removed and added lines, finer than the hunks the diff shows
 * (it joins changes a few lines apart into one hunk). Pure functions over the metadata `@pierre/diffs` produces from
 * two full files (`parseDiffFromFile`), declared structurally so this module stays dependency-free.
 */

export interface DisplayHunk {
  additionStart: number;
  deletionStart: number;
  hunkContent: ({ type: 'context'; lines: number } | { type: 'change'; deletions: number; additions: number })[];
}

/** Both files as lines, each keeping its line break (the last one has none when the file doesn't end with one). */
export interface DisplayMeta {
  deletionLines: string[];
  additionLines: string[];
  hunks: DisplayHunk[];
}

export type DiffSide = 'deletions' | 'additions';

/** A removed line (numbered in the original) or an added one (numbered in the modified file). */
export interface ChangedLine {
  side: DiffSide;
  lineNumber: number;
}

export interface ChangeBlock {
  index: number;
  /** First original line of the block; where the added lines go when nothing was removed. */
  oldStart: number;
  oldLines: number;
  /** First modified line of the block; where the removed lines were when nothing was added. */
  newStart: number;
  newLines: number;
}

export function listChangeBlocks(meta: DisplayMeta): ChangeBlock[] {
  const blocks: ChangeBlock[] = [];
  for (const hunk of meta.hunks) {
    let oldLine = hunk.deletionStart;
    let newLine = hunk.additionStart;
    for (const part of hunk.hunkContent) {
      if (part.type === 'context') {
        oldLine += part.lines;
        newLine += part.lines;
        continue;
      }
      blocks.push({ index: blocks.length, oldStart: oldLine, oldLines: part.deletions, newStart: newLine, newLines: part.additions });
      oldLine += part.deletions;
      newLine += part.additions;
    }
  }
  return blocks;
}

/** The block's removed lines, then its added ones: the order a unified diff shows them in. */
export function blockLines(block: ChangeBlock): ChangedLine[] {
  return [
    ...Array.from({ length: block.oldLines }, (_, offset): ChangedLine => ({ side: 'deletions', lineNumber: block.oldStart + offset })),
    ...Array.from({ length: block.newLines }, (_, offset): ChangedLine => ({ side: 'additions', lineNumber: block.newStart + offset })),
  ];
}

/**
 * A change as the diff shows it: blocks with no unchanged line between them, which read as one (the diff may split
 * a replacement into an insertion and a change, for instance).
 */
export interface ChangeRegion {
  index: number;
  /** Its changed lines, in the order the unified view shows them. */
  lines: ChangedLine[];
}

export function listChangeRegions(blocks: ChangeBlock[]): ChangeRegion[] {
  const regions: ChangeRegion[] = [];
  blocks.forEach((block, index) => {
    const previous = blocks[index - 1];
    const adjoins = previous && previous.oldStart + previous.oldLines === block.oldStart && previous.newStart + previous.newLines === block.newStart;
    if (adjoins) regions.at(-1)!.lines.push(...blockLines(block));
    else regions.push({ index: regions.length, lines: blockLines(block) });
  });
  return regions;
}

/** Whether two lists of changes cover the same lines: typing within a changed line leaves its change as it was. */
export function sameRegions(a: ChangeRegion[], b: ChangeRegion[]): boolean {
  return (
    a.length === b.length &&
    a.every((region, index) => region.lines.length === b[index]!.lines.length && region.lines.every((line, at) => line.side === b[index]!.lines[at]!.side && line.lineNumber === b[index]!.lines[at]!.lineNumber))
  );
}

/** Whether a line is one of the blocks' changed lines. */
export function isChanged(blocks: ChangeBlock[], { side, lineNumber }: ChangedLine): boolean {
  return blocks.some((block) => {
    const [start, count] = side === 'deletions' ? [block.oldStart, block.oldLines] : [block.newStart, block.newLines];
    return lineNumber >= start && lineNumber < start + count;
  });
}

/**
 * The change ⌥↓ (`direction` 1) or ⌥↑ (-1) moves to from the one holding `from` (the first picked line), round the
 * end of the diff; the first or last change when nothing is picked. Its index in `regions`, -1 when there is none.
 */
export function nextRegionIndex(regions: ChangeRegion[], from: ChangedLine | undefined, direction: 1 | -1): number {
  if (regions.length === 0) return -1;
  const current = from ? regions.findIndex((region) => region.lines.some((line) => line.side === from.side && line.lineNumber === from.lineNumber)) : -1;
  if (current === -1) return direction === 1 ? 0 : regions.length - 1;
  return (current + direction + regions.length) % regions.length;
}

export function regionContaining(regions: ChangeRegion[], line: ChangedLine): ChangeRegion | undefined {
  return regions.find((region) => region.lines.some((candidate) => candidate.side === line.side && candidate.lineNumber === line.lineNumber));
}
