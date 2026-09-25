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

export interface ChangeBlock {
  index: number;
  /** First original line of the block; where the added lines go when nothing was removed. */
  oldStart: number;
  oldLines: number;
  /** First modified line of the block; where the removed lines were when nothing was added. */
  newStart: number;
  newLines: number;
  /** The rendered line the block's actions attach to: the line just above it, else its first line. */
  anchor: { side: 'additions' | 'deletions'; lineNumber: number };
}

export function listChangeBlocks(meta: DisplayMeta): ChangeBlock[] {
  const blocks: ChangeBlock[] = [];
  for (const hunk of meta.hunks) {
    let oldLine = hunk.deletionStart;
    let newLine = hunk.additionStart;
    let contextAbove = false;
    for (const part of hunk.hunkContent) {
      if (part.type === 'context') {
        oldLine += part.lines;
        newLine += part.lines;
        contextAbove = part.lines > 0;
        continue;
      }
      const anchor: ChangeBlock['anchor'] = contextAbove
        ? { side: 'additions', lineNumber: newLine - 1 }
        : part.additions > 0
          ? { side: 'additions', lineNumber: newLine }
          : { side: 'deletions', lineNumber: oldLine };
      blocks.push({ index: blocks.length, oldStart: oldLine, oldLines: part.deletions, newStart: newLine, newLines: part.additions, anchor });
      oldLine += part.deletions;
      newLine += part.additions;
      contextAbove = false;
    }
  }
  return blocks;
}

/** The modified text with one block put back as it was in the original. */
export function revertChangeBlock(meta: DisplayMeta, block: ChangeBlock): string {
  // A side with no lines at all numbers its hunk from 0, not 1.
  const oldIndex = Math.max(0, block.oldStart - 1);
  const newIndex = Math.max(0, block.newStart - 1);
  return [
    ...meta.additionLines.slice(0, newIndex),
    ...meta.deletionLines.slice(oldIndex, oldIndex + block.oldLines),
    ...meta.additionLines.slice(newIndex + block.newLines),
  ].join('');
}
