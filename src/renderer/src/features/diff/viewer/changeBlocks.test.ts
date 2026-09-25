import { parseDiffFromFile } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { listChangeBlocks, revertChangeBlock, type DisplayMeta } from './changeBlocks';

const diff = (original: string, modified: string): DisplayMeta =>
  parseDiffFromFile({ name: 'a.ts', contents: original }, { name: 'a.ts', contents: modified });

const lines = (...items: string[]) => items.map((item) => `${item}\n`).join('');
const TWENTY = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`);

describe('listChangeBlocks', () => {
  it('splits a hunk into its separate runs of changes', () => {
    const modified = [...TWENTY];
    modified[3] = 'changed 4';
    modified.splice(6, 0, 'inserted');
    const blocks = listChangeBlocks(diff(lines(...TWENTY), lines(...modified)));
    expect(blocks.map(({ oldStart, oldLines, newStart, newLines }) => ({ oldStart, oldLines, newStart, newLines }))).toEqual([
      { oldStart: 4, oldLines: 1, newStart: 4, newLines: 1 },
      { oldStart: 7, oldLines: 0, newStart: 7, newLines: 1 },
    ]);
  });

  it('anchors a block on the line above it, or on its own first line at the top of a hunk', () => {
    const [first, second] = listChangeBlocks(diff(lines('a', 'b', 'c'), lines('A', 'b', 'C')));
    expect(first?.anchor).toEqual({ side: 'additions', lineNumber: 1 });
    expect(second?.anchor).toEqual({ side: 'additions', lineNumber: 2 });
    const [deletion] = listChangeBlocks(diff(lines('a', 'b'), lines('b')));
    expect(deletion?.anchor).toEqual({ side: 'deletions', lineNumber: 1 });
  });
});

describe('revertChangeBlock', () => {
  it('puts back only the chosen block', () => {
    const meta = diff(lines('a', 'b', 'c', 'd'), lines('A', 'b', 'c', 'D'));
    const [first] = listChangeBlocks(meta);
    expect(revertChangeBlock(meta, first!)).toBe(lines('a', 'b', 'c', 'D'));
  });

  it('undoes insertions and deletions', () => {
    const inserted = diff(lines('a', 'c'), lines('a', 'b', 'c'));
    expect(revertChangeBlock(inserted, listChangeBlocks(inserted)[0]!)).toBe(lines('a', 'c'));
    const deleted = diff(lines('a', 'b', 'c'), lines('a', 'c'));
    expect(revertChangeBlock(deleted, listChangeBlocks(deleted)[0]!)).toBe(lines('a', 'b', 'c'));
  });

  it('keeps line endings and a missing final line break', () => {
    const crlf = diff('a\r\nb\r\n', 'a\r\nB\r\n');
    expect(revertChangeBlock(crlf, listChangeBlocks(crlf)[0]!)).toBe('a\r\nb\r\n');
    const noFinalBreak = diff('a\nb', 'a\nb\nc\n');
    expect(revertChangeBlock(noFinalBreak, listChangeBlocks(noFinalBreak)[0]!)).toBe('a\nb');
  });

  it('empties a file that was all added, and refills one that was emptied', () => {
    const added = diff('', lines('x', 'y'));
    expect(revertChangeBlock(added, listChangeBlocks(added)[0]!)).toBe('');
    const emptied = diff(lines('x', 'y'), '');
    expect(revertChangeBlock(emptied, listChangeBlocks(emptied)[0]!)).toBe(lines('x', 'y'));
  });

  it('gets back the original by reverting every block, last to first', () => {
    const original = lines(...TWENTY);
    const modified = [...TWENTY];
    modified[0] = 'first';
    modified.splice(9, 2);
    modified.splice(14, 0, 'x', 'y');
    modified[modified.length - 1] = 'last';
    let text = lines(...modified);
    for (;;) {
      const meta = diff(original, text);
      const blocks = listChangeBlocks(meta);
      if (blocks.length === 0) break;
      text = revertChangeBlock(meta, blocks.at(-1)!);
    }
    expect(text).toBe(original);
  });
});
