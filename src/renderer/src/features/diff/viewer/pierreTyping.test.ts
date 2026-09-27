import { describe, expect, it } from 'vitest';
import { diskText, shownText } from '../../../lib/lineBreaks';
import { COMPARISON_METHODS } from './comparisonMethod';
import { hasLineChanges, lineDiff } from './lineDiff';
import { DIFF_TEST_TEXTS } from './diffTestTexts';
import { changesOf, fileChangesOf, typedIntoPierre } from './pierreSessionFixture';

/**
 * Typing into a diff, under every comparison method and every kind of text the viewer takes: after each keystroke,
 * the diff Pierre works out (what the view colors) is the one `lineDiff` works out (what the header counts and
 * discards act on), and the rows it shows stay the diff's rows.
 */

/** The editor's lines as it shows them (lone CRs as LFs), each with its line break. */
const linesOf = (text: string): string[] => shownText(text).match(/[^\n]*\n|[^\n]+$/g) ?? [];
const withoutBreak = (line: string): string => line.replace(/\r?\n$/, '');

describe('typing into a diff', () => {
  for (const [name, [original, modified]] of Object.entries(DIFF_TEST_TEXTS)) {
    for (const { value: method } of COMPARISON_METHODS) {
      // A diff with no lines to show is typed into whole, not as a diff.
      if (!hasLineChanges(lineDiff(original, modified, method))) continue;

      it(`keeps Pierre's diff the one lineDiff works out: ${name}, ${method}`, async () => {
        const session = await typedIntoPierre(original, modified, method);
        let lines = linesOf(modified);
        const problems: string[] = [];
        const compare = (what: string): void => {
          const text = diskText(lines.join(''), modified);
          const expected = changesOf(lineDiff(original, text, method).meta);
          const shown = fileChangesOf(session.diff);
          if (JSON.stringify(shown) !== JSON.stringify(expected)) problems.push(`${what}: shows ${JSON.stringify(shown)}, lineDiff has ${JSON.stringify(expected)}`);
          if (!session.rowsInStep()) problems.push(`${what}: the rows on screen aren't the diff's`);
        };
        const type = (index: number, content: string): void => {
          const own = lines[index]!;
          lines = lines.map((line, i) => (i === index ? content + own.slice(withoutBreak(own).length) : line));
          session.type(index, content);
          compare(`line ${index + 1} typed to ${JSON.stringify(content)}`);
        };
        const replace = (what: string, next: string[]): void => {
          lines = next;
          session.replace(lines.join(''));
          compare(what);
        };

        for (const index of [...new Set([0, 1, 2, 5, lines.length - 1])].filter((index) => index >= 0 && index < lines.length)) {
          const before = withoutBreak(lines[index]!);
          type(index, `${before} `);
          type(index, `${before} x`);
          type(index, `${before} `);
          type(index, before);
          type(index, `\t${before.trimStart()}`);
          type(index, before);
        }
        const eol = lines[0]?.endsWith('\r\n') ? '\r\n' : '\n';
        const start = lines;
        replace('a line inserted', [...start.slice(0, 2), `new();${eol}`, ...start.slice(2)]);
        replace('the line taken out again', start);
        replace('a line deleted', [...start.slice(0, 3), ...start.slice(4)]);
        replace('two lines pasted', [...start.slice(0, 1), `a();${eol}`, `b();${eol}`, ...start.slice(1)]);
        replace('the last lines deleted', [...start.slice(0, -2), `end();${eol}`]);
        replace('the text typed away', []);
        replace('back to how it was', start);
        expect(problems).toEqual([]);
      });
    }
  }
});

describe('typing into a file without a final line break', () => {
  it("recolors the line typed into: the rows on screen stay the diff's", async () => {
    const session = await typedIntoPierre('a\nb\nc\nd\ne\nf', 'A\nb\nc\nd\ne\nF', 'recognizeAll');
    session.type(3, 'dx');
    expect(changesOf(session.diff)).toEqual([
      { at: 0, removed: 1, added: 1 },
      { at: 3, removed: 1, added: 1 },
      { at: 5, removed: 1, added: 1 },
    ]);
    expect(session.rowsInStep()).toBe(true);
  });
});

