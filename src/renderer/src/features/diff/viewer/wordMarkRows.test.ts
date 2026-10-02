import { describe, expect, it } from 'vitest';
import { wordMarksIn, type RenderedNode } from './renderedWordMarks';
import { lineWordMarks, markedRow, rowWordMarks, type RenderedRow } from './wordMarkRows';

const span = (properties: Record<string, string | number>, ...children: RenderedNode[]): RenderedNode => ({ type: 'element', tagName: 'span', properties, children });
const text = (value: string): RenderedNode => ({ type: 'text', value });
const row = (...children: RenderedNode[]): RenderedRow => ({ type: 'element', tagName: 'div', properties: { 'data-line': 2, 'data-line-type': 'change-addition' }, children });

/** The text a row shows and the token each character belongs to (its `data-char`), what the editor reads. */
function tokensOf(node: RenderedNode, token: number | undefined = undefined): string {
  if (node.type === 'text') return node.value.replace(/./g, `${token ?? '-'}`.slice(-1));
  if (node.type !== 'element') return '';
  const own = node.properties?.['data-char'];
  return node.children.map((child) => tokensOf(child, own === undefined ? token : Number(own))).join('');
}
const textOf = (node: RenderedNode): string => (node.type === 'text' ? node.value : node.type === 'element' ? node.children.map(textOf).join('') : '');

/** A highlighted row as Pierre's token transformer renders it: `using Codice.CM.Common;`. */
const highlighted = row(
  span({ style: 'color:#D73A49', 'data-char': 0 }, text('using')),
  span({ style: 'color:#24292E', 'data-char': 5 }, text(' ')),
  span({ style: 'color:#005CC5', 'data-char': 6 }, text('Codice')),
  span({ style: 'color:#24292E', 'data-char': 12 }, text('.CM.Common;')),
);

describe('lineWordMarks', () => {
  it('marks the words each side changes, as Pierre does', () => {
    expect(lineWordMarks('using Codice.CM.Common;\n', 'Codice.CM.Commons;\n', 'word', 1_000)).toEqual({
      deletion: [
        { start: 0, end: 6 },
        { start: 16, end: 22 },
      ],
      addition: [{ start: 10, end: 17 }],
    });
  });

  it('marks nothing on lines longer than Pierre diffs', () => {
    expect(lineWordMarks('a b', 'a c', 'word', 2)).toEqual({ deletion: [], addition: [] });
  });
});

describe('markedRow', () => {
  it('wraps the marked text of whole tokens and of parts of tokens, keeping each token where it starts', () => {
    const marked = markedRow(highlighted, [
      { start: 0, end: 6 },
      { start: 16, end: 22 },
    ]);
    expect(wordMarksIn([marked])).toEqual(['using ', 'Common']);
    expect(textOf(marked)).toBe(textOf(highlighted));
    expect(tokensOf(marked)).toBe(tokensOf(highlighted));
    expect(marked.properties).toEqual(highlighted.properties);
  });

  it('marks a row again in place of the marks it had', () => {
    const once = markedRow(highlighted, [{ start: 6, end: 12 }]);
    const again = markedRow(once, [{ start: 0, end: 5 }]);
    expect(again).toEqual(markedRow(highlighted, [{ start: 0, end: 5 }]));
    expect(markedRow(once, [])).toEqual(markedRow(highlighted, []));
    expect(wordMarksIn([markedRow(once, [])])).toEqual([]);
  });

  it('marks plain text, which has no tokens', () => {
    const plain = row(text('alpha beta gamma'));
    const marked = markedRow(plain, [{ start: 6, end: 10 }]);
    expect(wordMarksIn([marked])).toEqual(['beta']);
    expect(textOf(marked)).toBe('alpha beta gamma');
  });

  it('keeps the empty line break of an empty row', () => {
    const empty = row({ type: 'element', tagName: 'br', properties: {}, children: [] });
    expect(markedRow(empty, [])).toEqual(empty);
  });
});

describe('rowWordMarks', () => {
  it('reads the marks a row has', () => {
    const marked = markedRow(highlighted, [
      { start: 0, end: 6 },
      { start: 16, end: 22 },
    ]);
    expect(rowWordMarks(marked)).toEqual([
      { start: 0, end: 6 },
      { start: 16, end: 22 },
    ]);
    expect(rowWordMarks(highlighted)).toEqual([]);
  });
});
