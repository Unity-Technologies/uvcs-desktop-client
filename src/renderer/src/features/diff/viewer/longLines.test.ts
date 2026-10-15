import { describe, expect, it } from 'vitest';
import { hasLineTooLongToDraw, LONGEST_DRAWN_LINE, withLongLinesCut } from './longLines';

const line = (length: number): string => 'var a=b;'.repeat(Math.ceil(length / 8)).slice(0, length);

describe('hasLineTooLongToDraw', () => {
  it('tells a minified file of several megabytes, all on one line', () => {
    expect(hasLineTooLongToDraw([line(4_000_000)])).toBe(true);
  });

  it(`draws a line of ${LONGEST_DRAWN_LINE} characters unwrapped, and an empty text`, () => {
    expect(hasLineTooLongToDraw([line(LONGEST_DRAWN_LINE), ''])).toBe(false);
    expect(hasLineTooLongToDraw([line(LONGEST_DRAWN_LINE + 1)])).toBe(true);
  });

  it('finds the one long line among normal ones, in either text', () => {
    const normal = Array.from({ length: 1_000 }, (_, index) => `const value${index} = ${index};`);
    const withLong = [...normal.slice(0, 500), line(LONGEST_DRAWN_LINE + 1), ...normal.slice(500)];
    expect(hasLineTooLongToDraw([normal.join('\n'), normal.join('\n')])).toBe(false);
    expect(hasLineTooLongToDraw([normal.join('\n'), withLong.join('\n')])).toBe(true);
  });

  it('breaks lines at LF, CRLF and a lone CR', () => {
    const half = line(LONGEST_DRAWN_LINE / 2 + 1);
    expect(hasLineTooLongToDraw([`${half}\r\n${half}`])).toBe(false);
    expect(hasLineTooLongToDraw([`${half}\r${half}`])).toBe(false);
    expect(hasLineTooLongToDraw([`${half}${half}\n`])).toBe(true);
  });

  it('draws a big CSV of many short lines unwrapped, and wraps the same records written as one line of JSON', () => {
    const records = Array.from({ length: 100_000 }, (_, index) => ({ id: index, name: `name${index}`, total: index * 2 }));
    const csv = records.map(({ id, name, total }) => `${id},${name},${total}`).join('\r\n');
    expect(csv.length).toBeGreaterThan(LONGEST_DRAWN_LINE);
    expect(hasLineTooLongToDraw([csv])).toBe(false);
    expect(hasLineTooLongToDraw([JSON.stringify(records)])).toBe(true);
  });
});

describe('withLongLinesCut', () => {
  it(`cuts each line past ${LONGEST_DRAWN_LINE} characters there, with an ellipsis, and keeps every line break`, () => {
    const long = line(LONGEST_DRAWN_LINE + 10);
    const cut = `${long.slice(0, LONGEST_DRAWN_LINE)}…`;
    expect(withLongLinesCut(`first\r\n${long}\n${long}\rlast`)).toBe(`first\r\n${cut}\n${cut}\rlast`);
  });

  it('cuts before a character written in two code units rather than between them', () => {
    const emoji = `a${'😀'.repeat(LONGEST_DRAWN_LINE / 2 + 1)}`;
    expect(withLongLinesCut(emoji)).toBe(`${emoji.slice(0, LONGEST_DRAWN_LINE - 1)}…`);
  });

  it('gives back a text with no line that long as it is', () => {
    const text = `${line(LONGEST_DRAWN_LINE)}\nshort\n`;
    expect(withLongLinesCut(text)).toBe(text);
  });
});
