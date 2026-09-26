import { parseDiffFromFile } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { blockLines, listChangeBlocks, type ChangedLine, type DisplayMeta } from './changeBlocks';
import type { ComparisonMethod } from './comparisonMethod';
import { lineDiff, lineDiffOptions } from './lineDiff';
import { shownText } from '../../../lib/lineBreaks';
import { discardLines, withOwnLines } from './discardLines';

const diff = (original: string, modified: string): DisplayMeta =>
  parseDiffFromFile({ name: 'a.cs', contents: original }, { name: 'a.cs', contents: modified });

const diffUnder = (method: ComparisonMethod, original: string, modified: string): DisplayMeta =>
  parseDiffFromFile({ name: 'a.cs', contents: original }, { name: 'a.cs', contents: modified }, lineDiffOptions(original, modified, method));

const lines = (...items: string[]) => items.map((item) => `${item}\n`).join('');
const TWENTY = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`);
const removedLine = (lineNumber: number): ChangedLine => ({ side: 'deletions', lineNumber });
const addedLine = (lineNumber: number): ChangedLine => ({ side: 'additions', lineNumber });

const discardBlock = (meta: DisplayMeta, index: number) => discardLines(meta, blockLines(listChangeBlocks(meta)[index]!)).text;
const discardText = (meta: DisplayMeta, lines: ChangedLine[]) => discardLines(meta, lines).text;

describe('discardLines, whole blocks', () => {
  it('reverts only the chosen block', () => {
    expect(discardBlock(diff(lines('a', 'b', 'c', 'd'), lines('A', 'b', 'c', 'D')), 0)).toBe(lines('a', 'b', 'c', 'D'));
  });

  it('removes added lines and restores removed ones', () => {
    expect(discardBlock(diff(lines('a', 'c'), lines('a', 'b', 'c')), 0)).toBe(lines('a', 'c'));
    expect(discardBlock(diff(lines('a', 'b', 'c'), lines('a', 'c')), 0)).toBe(lines('a', 'b', 'c'));
  });

  it('replaces a changed block with the original, whatever the length of each side', () => {
    expect(discardBlock(diff(lines('a', 'b', 'z'), lines('a', 'x', 'y', 'w', 'z')), 0)).toBe(lines('a', 'b', 'z'));
    expect(discardBlock(diff(lines('a', 'b', 'c', 'd', 'z'), lines('a', 'x', 'z')), 0)).toBe(lines('a', 'b', 'c', 'd', 'z'));
  });

  it('keeps CRLF line endings and a missing final line break', () => {
    expect(discardBlock(diff('a\r\nb\r\n', 'a\r\nB\r\n'), 0)).toBe('a\r\nb\r\n');
    expect(discardBlock(diff('a\nb', 'a\nb\nc\n'), 0)).toBe('a\nb');
  });

  it('empties a file that was all added, and refills one that was emptied', () => {
    expect(discardBlock(diff('', lines('x', 'y')), 0)).toBe('');
    expect(discardBlock(diff(lines('x', 'y'), ''), 0)).toBe(lines('x', 'y'));
  });

  it('gets back the original by discarding every block, in any order', () => {
    const original = lines(...TWENTY);
    const modified = [...TWENTY];
    modified[0] = 'first';
    modified.splice(9, 2);
    modified.splice(14, 0, 'x', 'y');
    modified[modified.length - 1] = 'last';
    for (const pick of [(count: number) => count - 1, () => 0]) {
      let text = lines(...modified);
      for (;;) {
        const meta = diff(original, text);
        const blocks = listChangeBlocks(meta);
        if (blocks.length === 0) break;
        text = discardBlock(meta, pick(blocks.length));
      }
      expect(text).toBe(original);
    }
  });

  it('discards every block at once', () => {
    const meta = diff(lines('a', 'b', 'c', 'd', 'e'), lines('A', 'b', 'd', 'e', 'f'));
    expect(discardText(meta, listChangeBlocks(meta).flatMap(blockLines))).toBe(lines('a', 'b', 'c', 'd', 'e'));
  });
});

describe('discardLines, some lines', () => {
  // a b c d → a X Y d: one block, b c removed and X Y added.
  const meta = diff(lines('a', 'b', 'c', 'd'), lines('a', 'X', 'Y', 'd'));

  it('removes only the chosen added lines', () => {
    expect(discardText(meta, [addedLine(3)])).toBe(lines('a', 'X', 'd'));
  });

  it('puts removed lines back before the added lines that stay', () => {
    expect(discardText(meta, [removedLine(3)])).toBe(lines('a', 'c', 'X', 'Y', 'd'));
  });

  it('takes a range spanning removed and added lines', () => {
    expect(discardText(meta, [removedLine(3), addedLine(2)])).toBe(lines('a', 'c', 'Y', 'd'));
  });

  it('spans several blocks', () => {
    const two = diff(lines('a', 'b', 'c', 'd', 'e'), lines('a', 'B', 'c', 'x', 'd'));
    expect(discardText(two, [addedLine(2), addedLine(4)])).toBe(lines('a', 'c', 'd'));
  });

  it('keeps CRLF line endings', () => {
    const crlf = diff('a\r\nb\r\nc\r\n', 'a\r\nX\r\nY\r\nc\r\n');
    expect(discardText(crlf, [addedLine(3)])).toBe('a\r\nX\r\nc\r\n');
    expect(discardText(crlf, [removedLine(2)])).toBe('a\r\nb\r\nX\r\nY\r\nc\r\n');
  });

  it("gives a restored last line without a line break the file's own when lines follow it", () => {
    // 'b' without a break became 'b\n' and 'c': restore 'b' but keep the added lines.
    expect(discardText(diff('a\nb', 'a\nb\nc\n'), [removedLine(2)])).toBe('a\nb\nb\nc\n');
    expect(discardText(diff('a\r\nb', 'a\r\nb\r\nc\r\n'), [removedLine(2)])).toBe('a\r\nb\r\nb\r\nc\r\n');
  });

  it('removes a last added line without a line break', () => {
    expect(discardText(diff('a\nb\n', 'a\nb\nc'), [addedLine(3)])).toBe('a\nb\n');
  });

  it('tells where the restored lines are', () => {
    expect(discardLines(meta, [removedLine(2), removedLine(3), addedLine(2)]).restoredAt).toEqual([2, 3]);
    expect(discardLines(diff(lines('a', 'b', 'c', 'd', 'e'), lines('A', 'b', 'd', 'e')), [removedLine(1), removedLine(3)]).restoredAt).toEqual([1, 4]);
  });

  it('changes nothing when no line is chosen', () => {
    expect(discardText(meta, [])).toBe(lines('a', 'X', 'Y', 'd'));
  });
});

describe('discardLines, with changes the comparison method hides', () => {
  it('restores the original line with the line endings of the modified file', () => {
    const meta = diffUnder('ignoreEol', 'a\nb\nc\n', 'a\r\nB\r\nc\r\n');
    expect(listChangeBlocks(meta)).toHaveLength(1);
    expect(discardLines(meta, blockLines(listChangeBlocks(meta)[0]!), 'ignoreEol').text).toBe('a\r\nb\r\nc\r\n');
  });

  it('restores the original line and keeps the hidden reindentation of the others', () => {
    const meta = diffUnder('ignoreWhitespace', 'if (x)\n    y = 1;\n    z = 2;\n', 'if (x)\n\ty = 1;\n\tz = 3;\n');
    expect(listChangeBlocks(meta)).toEqual([{ index: 0, oldStart: 3, oldLines: 1, newStart: 3, newLines: 1 }]);
    expect(discardBlock(meta, 0)).toBe('if (x)\n\ty = 1;\n    z = 2;\n');
  });

  it('removes an added line among lines whose line endings changed', () => {
    const meta = diffUnder('ignoreEolAndWhitespace', 'a\nb\n', 'a \r\nnew\r\nb\r\n');
    expect(discardLines(meta, [addedLine(2)], 'ignoreEolAndWhitespace').text).toBe('a \r\nb\r\n');
  });
});

describe('discardLines and line endings', () => {
  const discardAll = (meta: DisplayMeta, method: ComparisonMethod) => discardLines(meta, listChangeBlocks(meta).flatMap(blockLines), method).text;

  it('makes a file whose line endings changed identical to the original when they show (Recognize all)', () => {
    expect(discardAll(diffUnder('recognizeAll', 'a\nb\nc\n', 'a\r\nb\r\nc\r\n'), 'recognizeAll')).toBe('a\nb\nc\n');
    expect(discardAll(diffUnder('recognizeAll', 'a\r\nb\r\n', 'a\nb\n'), 'recognizeAll')).toBe('a\r\nb\r\n');
    expect(discardAll(diffUnder('ignoreWhitespace', 'a\nb\n', 'a\r\nb\r\n'), 'ignoreWhitespace')).toBe('a\nb\n');
  });

  it('restores lines exactly as they were when line endings show, even among other changes', () => {
    const meta = diffUnder('recognizeAll', 'a\nb\nc\nd', 'a\r\nB\r\nc\r\nD');
    expect(discardAll(meta, 'recognizeAll')).toBe('a\nb\nc\nd');
  });

  for (const method of ['ignoreEol', 'ignoreEolAndWhitespace'] as const) {
    it(`gives LF lines restored into a CRLF file CRLF when line endings are hidden (${method})`, () => {
      const text = discardAll(diffUnder(method, 'a\nb\nc\nd', 'a\r\nB\r\nc\r\nD'), method);
      expect(text).toBe('a\r\nb\r\nc\r\nd');
    });

    it(`gives CRLF lines restored into an LF file LF when line endings are hidden (${method})`, () => {
      const text = discardAll(diffUnder(method, 'a\r\nb\r\nc\r\n', 'a\nB\nc\nx'), method);
      expect(text).toBe('a\nb\nc\n');
    });
  }

  it('follows the most common line ending of a file that mixes them when line endings are hidden', () => {
    const meta = diffUnder('ignoreEol', 'a\nb\nc\nd\n', 'a\r\nB\r\nc\r\nd\n');
    expect(discardLines(meta, blockLines(listChangeBlocks(meta)[0]!), 'ignoreEol').text).toBe('a\r\nb\r\nc\r\nd\n');
  });
});

describe('discardLines in files with lone CRs', () => {
  /** As the viewer does it: Pierre diffs the texts shown with lone CRs as LFs, the discard takes the files' own lines. */
  const discardIn = (original: string, modified: string, pick: (meta: DisplayMeta) => ChangedLine[], method: ComparisonMethod = 'recognizeAll') => {
    const meta = lineDiff(original, modified, method, 'a.cs').meta;
    return discardLines(withOwnLines(meta, original, modified), pick(meta), method).text;
  };
  const everything = (meta: DisplayMeta) => listChangeBlocks(meta).flatMap(blockLines);
  const mac = (...items: string[]) => items.map((item) => `${item}\r`).join('');

  it('sees one changed line in a file of lone CRs, and reverts it keeping every CR', () => {
    const original = mac(...TWENTY);
    const changed = [...TWENTY];
    changed[6] = 'line 7 changed';
    const modified = mac(...changed);
    expect(listChangeBlocks(diffUnder('recognizeAll', shownText(original), shownText(modified)))).toEqual([{ index: 0, oldStart: 7, oldLines: 1, newStart: 7, newLines: 1 }]);
    expect(discardIn(original, modified, everything)).toBe(original);
  });

  it('removes and restores single lines of a file of lone CRs', () => {
    expect(discardIn(mac('a', 'b', 'c'), mac('a', 'X', 'Y', 'c'), () => [addedLine(3)])).toBe(mac('a', 'X', 'c'));
    expect(discardIn(mac('a', 'b', 'c'), mac('a', 'X', 'Y', 'c'), () => [removedLine(2)])).toBe(mac('a', 'b', 'X', 'Y', 'c'));
  });

  it('gives a restored last line without a line break a CR when lines follow it', () => {
    expect(discardIn('a\rb', mac('a', 'b', 'c'), () => [removedLine(2)])).toBe(mac('a', 'b', 'b', 'c'));
  });

  it("keeps each line's own line break in a file that mixes CR, LF and CRLF", () => {
    const original = 'a\r\nb\nc\rd\r\n';
    expect(discardIn(original, 'a\r\nB\nc\rD\r\n', everything)).toBe(original);
    expect(discardIn(original, 'a\r\nb\nc\rX\rd\r\n', everything)).toBe(original);
  });

  it('turns a file of lone CRs made LF back to CRs when line endings show', () => {
    expect(discardIn(mac('a', 'b'), 'a\nb\n', everything)).toBe(mac('a', 'b'));
    expect(discardIn('a\nb\n', mac('a', 'b'), everything)).toBe('a\nb\n');
  });

  it('gives restored lines the lone CRs of the file when line endings are hidden', () => {
    expect(discardIn('a\nb\nc\n', mac('a', 'B', 'c'), everything, 'ignoreEol')).toBe(mac('a', 'b', 'c'));
    expect(discardIn(mac('a', 'b', 'c'), 'a\r\nB\r\nc\r\n', everything, 'ignoreEol')).toBe('a\r\nb\r\nc\r\n');
  });
});
