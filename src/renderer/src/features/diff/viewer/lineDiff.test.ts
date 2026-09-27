import { describe, expect, it } from 'vitest';
import { blockLines, listChangeBlocks } from './changeBlocks';
import { COMPARISON_METHODS, type ComparisonMethod } from './comparisonMethod';
import { discardLines, withOwnLines } from './discardLines';
import { DIFF_TEST_TEXTS } from './diffTestTexts';
import { differsUnder, hasLineChanges, lineDiff } from './lineDiff';
import { changesOf, typedIntoPierre } from './pierreSessionFixture';
import { shownDiff } from './shownDiff';

const stats = (original: string, modified: string, method: ComparisonMethod = 'recognizeAll') => {
  const { added, removed } = lineDiff(original, modified, method);
  return { added, removed };
};

describe('lineDiff counts', () => {
  it('counts nothing for identical texts', () => {
    expect(stats('a\nb\n', 'a\nb\n')).toEqual({ added: 0, removed: 0 });
    expect(stats('', '')).toEqual({ added: 0, removed: 0 });
  });

  it('counts every line of a new file as added, and of a deleted one as removed', () => {
    expect(stats('', 'a\nb\nc\n')).toEqual({ added: 3, removed: 0 });
    expect(stats('a\nb\n', '')).toEqual({ added: 0, removed: 2 });
  });

  it('counts a changed line as one removed and one added, and changes in different places', () => {
    expect(stats('a\nb\nc\n', 'a\nB\nc\n')).toEqual({ added: 1, removed: 1 });
    expect(stats('a\nb\nc\nd\n', 'x\na\nb\nd\ny\n')).toEqual({ added: 2, removed: 1 });
  });

  it('breaks lines at lone CRs too', () => {
    expect(stats('a\rb\rc\r', 'a\rB\rc\r')).toEqual({ added: 1, removed: 1 });
    expect(stats('a\rb\r', 'a\rb\r')).toEqual({ added: 0, removed: 0 });
    expect(stats('a\r\nb\nc\r', 'a\r\nb\nC\r')).toEqual({ added: 1, removed: 1 });
  });

  it('counts lone CRs made LFs (or CRLFs) only when line endings count', () => {
    expect(stats('a\rb\r', 'a\nb\n')).toEqual({ added: 2, removed: 2 });
    expect(stats('a\rb\r', 'a\r\nb\r\n')).toEqual({ added: 2, removed: 2 });
    expect(stats('a\rb\r', 'a\nb\n', 'ignoreWhitespace')).toEqual({ added: 2, removed: 2 });
    expect(stats('a\rb\r', 'a\nb\n', 'ignoreEol')).toEqual({ added: 0, removed: 0 });
    expect(stats('a\rb\r', 'a\r\nB\r\n', 'ignoreEolAndWhitespace')).toEqual({ added: 1, removed: 1 });
  });

  it('counts only the changes the comparison method recognizes', () => {
    const original = 'a\n  b\nc\n';
    const modified = 'a\r\n\tb\r\nC\r\n';
    expect(stats(original, modified)).toEqual({ added: 3, removed: 3 });
    expect(stats(original, modified, 'ignoreEol')).toEqual({ added: 2, removed: 2 });
    expect(stats(original, modified, 'ignoreWhitespace')).toEqual({ added: 3, removed: 3 });
    expect(stats(original, modified, 'ignoreEolAndWhitespace')).toEqual({ added: 1, removed: 1 });
  });
});

describe('differsUnder', () => {
  it('finds nothing to show for a file not changed yet, empty, or whose only changes the method hides', () => {
    expect(differsUnder('one\ntwo\n', 'one\ntwo\n', 'recognizeAll')).toBe(false);
    expect(differsUnder('one\rtwo\r', 'one\rtwo\r', 'recognizeAll')).toBe(false);
    expect(differsUnder('', '', 'recognizeAll')).toBe(false);
    expect(differsUnder('one\ntwo\n', 'one\r\ntwo\r\n', 'ignoreEol')).toBe(false);
    expect(differsUnder('one\rtwo\r', 'one\ntwo\n', 'ignoreEol')).toBe(false);
    expect(differsUnder('one\n', '  one\n', 'ignoreWhitespace')).toBe(false);
  });

  it('finds lines to show in a changed, added or typed-into file', () => {
    expect(differsUnder('one\ntwo\n', 'one\n2\n', 'recognizeAll')).toBe(true);
    expect(differsUnder('', 'added\n', 'recognizeAll')).toBe(true);
    expect(differsUnder('', 'typed into an empty file', 'ignoreEolAndWhitespace')).toBe(true);
    expect(differsUnder('one\ntwo\n', 'one\r\ntwo\r\n', 'recognizeAll')).toBe(true);
    expect(differsUnder('one\rtwo\r', 'one\rTWO\r', 'recognizeAll')).toBe(true);
    expect(differsUnder('one\rtwo\r', 'one\ntwo\n', 'recognizeAll')).toBe(true);
  });

  it('tells what the diff tells, under every method, without diffing the texts under one that ignores something', () => {
    const eolsAndWhitespace = (text: string, eol: string) => text.replace(/\r\n|\r|\n/g, eol).replace(/^( *)/gm, '\t$1');
    for (const [original, modified] of Object.values(DIFF_TEST_TEXTS)) {
      const pairs: [string, string][] = [
        [original, modified],
        [original, original.replace(/\r\n|\r|\n/g, '\r\n')],
        [original, original.replace(/\r\n|\r|\n/g, '\n')],
        [original, original.replace(/\r\n|\r|\n/g, '\r')],
        [original, original.replace(/ +$/gm, '  ')],
        [original, eolsAndWhitespace(original, '\n')],
        [original, original.replace(/\n$/, '')],
      ];
      for (const [left, right] of pairs) {
        for (const { value: method } of COMPARISON_METHODS) {
          expect(differsUnder(left, right, method), `${JSON.stringify(left)} → ${JSON.stringify(right)} under ${method}`).toBe(hasLineChanges(lineDiff(left, right, method)));
        }
      }
    }
  });
});

/**
 * Every way the viewer reads a diff agrees, under every comparison method: what Pierre shows while the file is typed
 * into, the diff shown once it's saved, the +N −M in the header, and the blocks discards act on.
 */
describe('one diff, typed or saved, counted or discarded', () => {
  const LINES = ['alpha', '  beta', 'gamma delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota'];
  const lf = (lines: string[]) => lines.map((line) => `${line}\n`).join('');
  const original = lf(LINES);
  // The file already has a change of its own, so it shows as a diff rather than typed into whole.
  const modified = lf(LINES.map((line) => (line === 'zeta' ? 'ZETA' : line)));
  const editedLine = 2;
  const withLine = (text: string) => lf(LINES.map((line, index) => (line === 'zeta' ? 'ZETA' : index === editedLine ? text : line)));
  const ZETA = { at: 4, removed: 1, added: 1 };
  const EDITED = { at: 2, removed: 1, added: 1 };
  const EVERY_LINE = { at: 0, removed: LINES.length, added: LINES.length };

  type Edit = { name: string; saved: string; typed?: string; shows: Record<ComparisonMethod, object[]> };
  const byMethod = (recognizeAll: object[], ignoreEol: object[], ignoreWhitespace: object[], ignoreEolAndWhitespace: object[]) => ({ recognizeAll, ignoreEol, ignoreWhitespace, ignoreEolAndWhitespace });
  const EDITS: Edit[] = [
    { name: 'adds trailing spaces', typed: 'gamma delta   ', saved: withLine('gamma delta   '), shows: byMethod([EDITED, ZETA], [EDITED, ZETA], [ZETA], [ZETA]) },
    { name: 'adds leading spaces', typed: '\t  gamma delta', saved: withLine('\t  gamma delta'), shows: byMethod([EDITED, ZETA], [EDITED, ZETA], [ZETA], [ZETA]) },
    { name: 'changes whitespace inside a line', typed: 'gamma  delta', saved: withLine('gamma  delta'), shows: byMethod([EDITED, ZETA], [EDITED, ZETA], [EDITED, ZETA], [EDITED, ZETA]) },
    { name: 'makes a real change', typed: 'gamma DELTA', saved: withLine('gamma DELTA'), shows: byMethod([EDITED, ZETA], [EDITED, ZETA], [EDITED, ZETA], [EDITED, ZETA]) },
    { name: 'turns LF into CRLF', saved: modified.replaceAll('\n', '\r\n'), shows: byMethod([EVERY_LINE], [ZETA], [EVERY_LINE], [ZETA]) },
    { name: 'turns LF into lone CRs', saved: modified.replaceAll('\n', '\r'), shows: byMethod([EVERY_LINE], [ZETA], [EVERY_LINE], [ZETA]) },
  ];

  for (const { value: method } of COMPARISON_METHODS) {
    for (const { name, saved, typed, shows } of EDITS) {
      it(`${method}: ${name}`, async () => {
        // Typing: Pierre re-diffs the text in its edit session, keystroke by keystroke or as a whole.
        const session = await typedIntoPierre(original, modified, method, saved);
        if (typed === undefined) session.replace(saved);
        else for (let length = 1; length <= typed.length; length++) session.type(editedLine, typed.slice(0, length));
        const typing = changesOf(session.diff);

        // Saved: the diff shown anew, which the header counts and discards read, from the file as it is now.
        const diff = lineDiff(original, saved, method, 'file.ts');
        const shown = changesOf(shownDiff(diff.meta, { original: true, modified: true }, original, saved));
        const blocks = listChangeBlocks(diff.meta).map(({ oldStart, oldLines, newLines }) => ({ at: oldStart - 1, removed: oldLines, added: newLines }));

        expect(typing).toEqual(shows[method]);
        expect(shown).toEqual(shows[method]);
        expect(blocks).toEqual(shows[method]);
        expect({ added: diff.added, removed: diff.removed }).toEqual({
          added: typing.reduce((sum, change) => sum + change.added, 0),
          removed: typing.reduce((sum, change) => sum + change.removed, 0),
        });

        // Discarding every change shown leaves nothing the method recognizes; recognizing all, the original itself.
        const everything = listChangeBlocks(diff.meta).flatMap(blockLines);
        const { text } = discardLines(withOwnLines(diff.meta, original, saved), everything, method);
        expect(hasLineChanges(lineDiff(original, text, method))).toBe(false);
        if (method === 'recognizeAll') expect(text).toBe(original);
      });
    }

    it(`${method}: types a character into a file of lone CRs made LFs and deletes it`, async () => {
      const crs = original.replaceAll('\n', '\r');
      const session = await typedIntoPierre(crs, original, method);
      session.type(editedLine, 'gamma deltax');
      session.type(editedLine, 'gamma delta');
      expect(changesOf(session.diff)).toEqual(changesOf(lineDiff(crs, original, method, 'file.ts').meta));
    });
  }
});
