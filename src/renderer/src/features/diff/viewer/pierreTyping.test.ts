import { describe, expect, it } from 'vitest';
import { diskText, shownText } from '../../../lib/lineBreaks';
import { COMPARISON_METHODS } from './comparisonMethod';
import { hasLineChanges, lineDiff } from './lineDiff';
import { changesOf, fileChangesOf, typedIntoPierre } from './pierreSessionFixture';

/**
 * Typing into a diff, under every comparison method and every kind of text the viewer takes: after each keystroke,
 * the diff Pierre works out (what the view colors) is the one `lineDiff` works out (what the header counts and
 * discards act on), and the rows it shows stay the diff's rows.
 */

const CODE = Array.from({ length: 12 }, (_, i) => (i % 4 === 0 ? `function f${i}() {` : i % 4 === 3 ? '}' : `  const v${i} = ${i};`));
const edited = (lines: string[]) => lines.map((line, i) => (i === 0 ? `${line} // first` : i === 5 ? 'middle();' : i === lines.length - 1 ? `${line} // last` : line));
const joined = (lines: string[], eol: string, final = true) => lines.join(eol) + (final ? eol : '');
const mixed = (lines: string[]) => lines.map((line, i) => line + ['\n', '\r\n', '\r'][i % 3]).join('');

const TEXTS: Record<string, [original: string, modified: string]> = {
  'LF': [joined(CODE, '\n'), joined(edited(CODE), '\n')],
  'CRLF': [joined(CODE, '\r\n'), joined(edited(CODE), '\r\n')],
  'lone CRs': [joined(CODE, '\r'), joined(edited(CODE), '\r')],
  'mixed line breaks': [mixed(CODE), mixed(edited(CODE))],
  'no final line break': [joined(CODE, '\n', false), joined(edited(CODE), '\n', false)],
  'CRLF, no final line break': [joined(CODE, '\r\n', false), joined(edited(CODE), '\r\n', false)],
  'final line break removed': [joined(CODE, '\n'), joined(edited(CODE), '\n', false)],
  'final line break added': [joined(CODE, '\n', false), joined(edited(CODE), '\n')],
  'CRLF made LF': [joined(CODE, '\r\n'), joined(edited(CODE), '\n')],
  'lone CRs made LF': [joined(CODE, '\r'), joined(edited(CODE), '\n')],
  'whitespace': [joined(CODE, '\n'), joined(CODE.map((line, i) => (i === 2 ? `${line}  ` : i === 6 ? `\t${line.trimStart()}` : i === 9 ? line.replace(' = ', '  =  ') : line)), '\n')],
  'lines added and removed': [joined(CODE, '\n'), joined([...CODE.slice(0, 3), 'inserted();', ...CODE.slice(3, 7), ...CODE.slice(8)], '\n')],
  'from an empty file': ['', joined(CODE.slice(0, 5), '\n')],
  'emptied': [joined(CODE.slice(0, 5), '\n'), ''],
};

/** The editor's lines as it shows them (lone CRs as LFs), each with its line break. */
const linesOf = (text: string): string[] => shownText(text).match(/[^\n]*\n|[^\n]+$/g) ?? [];
const withoutBreak = (line: string): string => line.replace(/\r?\n$/, '');

describe('typing into a diff', () => {
  for (const [name, [original, modified]] of Object.entries(TEXTS)) {
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

