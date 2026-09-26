import { describe, expect, it } from 'vitest';
import { crAgainstLf, diskText, dominantLineBreak, endsWithLineBreak, hasLoneCr, lineBreakOf, shownText, splitLines } from './lineBreaks';

const mac = (...lines: string[]) => lines.map((line) => `${line}\r`).join('');
const unix = (...lines: string[]) => lines.map((line) => `${line}\n`).join('');
const dos = (...lines: string[]) => lines.map((line) => `${line}\r\n`).join('');
/** 1 CRLF, 2 LF, 3 CR, 4 CRLF... */
const MIXED = 'a\r\nb\nc\rd\r\ne\nf\r';

describe('hasLoneCr', () => {
  it('finds a CR that is not part of a CRLF', () => {
    expect(hasLoneCr(mac('a', 'b'))).toBe(true);
    expect(hasLoneCr(MIXED)).toBe(true);
    expect(hasLoneCr('a\rb')).toBe(true);
    expect(hasLoneCr(dos('a', 'b'))).toBe(false);
    expect(hasLoneCr(unix('a', 'b'))).toBe(false);
    expect(hasLoneCr('')).toBe(false);
  });
});

describe('shownText', () => {
  it('shows each lone CR as a LF, keeping CRLFs and LFs', () => {
    expect(shownText(mac('a', 'b'))).toBe(unix('a', 'b'));
    expect(shownText('a\rb')).toBe('a\nb');
    expect(shownText(MIXED)).toBe('a\r\nb\nc\nd\r\ne\nf\n');
  });

  it('leaves texts without lone CRs as they are', () => {
    const crlf = dos('a', 'b');
    expect(shownText(crlf)).toBe(crlf);
    expect(shownText(unix('a'))).toBe(unix('a'));
  });
});

describe('splitLines', () => {
  it('breaks lines at LF, CRLF and lone CRs, each keeping its own line break', () => {
    expect(splitLines(MIXED)).toEqual(['a\r\n', 'b\n', 'c\r', 'd\r\n', 'e\n', 'f\r']);
    expect(splitLines(mac('a', 'b'))).toEqual(['a\r', 'b\r']);
    expect(splitLines('a\r\nb\nc')).toEqual(['a\r\n', 'b\n', 'c']);
    expect(splitLines('\r\r')).toEqual(['\r', '\r']);
    expect(splitLines('')).toEqual([]);
  });

  it('gives the text back when joined', () => {
    for (const text of [MIXED, mac('a', '', 'b'), 'x\ry', dos('a'), unix('a', 'b')]) expect(splitLines(text).join('')).toBe(text);
  });

  it('gives as many lines as the text shows', () => {
    expect(splitLines(MIXED)).toHaveLength(splitLines(shownText(MIXED)).length);
  });
});

describe('line breaks of lines', () => {
  it('tells each one', () => {
    expect(['a\r\n', 'a\n', 'a\r', 'a'].map(lineBreakOf)).toEqual(['\r\n', '\n', '\r', '']);
    expect(endsWithLineBreak('a\r')).toBe(true);
    expect(endsWithLineBreak('a\n')).toBe(true);
    expect(endsWithLineBreak('a')).toBe(false);
  });

  it('finds the most common, LF on a tie', () => {
    expect(dominantLineBreak(splitLines(mac('a', 'b') + 'c\n'))).toBe('\r');
    expect(dominantLineBreak(splitLines(dos('a', 'b')))).toBe('\r\n');
    expect(dominantLineBreak(['a\r', 'b\n'])).toBe('\n');
    expect(dominantLineBreak(['a'])).toBeUndefined();
  });
});

describe('diskText', () => {
  it('writes texts without lone CRs as shown', () => {
    expect(diskText(unix('a', 'X'), unix('a', 'b'))).toBe(unix('a', 'X'));
    expect(diskText(dos('a', 'X'), dos('a', 'b'))).toBe(dos('a', 'X'));
  });

  it('gives a file of lone CRs back byte for byte but for the edit', () => {
    const disk = mac('one', 'two', 'three', 'four');
    expect(diskText(shownText(disk), disk)).toBe(disk);
    expect(diskText(unix('one', 'TWO', 'three', 'four'), disk)).toBe(mac('one', 'TWO', 'three', 'four'));
    expect(diskText(unix('one', 'two', 'new', 'three', 'four'), disk)).toBe(mac('one', 'two', 'new', 'three', 'four'));
    expect(diskText(unix('one', 'four'), disk)).toBe(mac('one', 'four'));
    expect(diskText('one\ntwo\nthree\nfour', disk)).toBe('one\rtwo\rthree\rfour');
    expect(diskText('', disk)).toBe('');
  });

  it('keeps each line of a mixed file its own line break, edits anywhere', () => {
    expect(diskText('A\r\nb\nc\nd\r\nE\nf\n', MIXED)).toBe('A\r\nb\nc\rd\r\nE\nf\r');
    // A new line takes the most common line break: here LF, CR and CRLF tie at two each, so LF.
    expect(diskText('a\r\nb\nnew\nc\nd\r\ne\nf\n', MIXED)).toBe('a\r\nb\nnew\nc\rd\r\ne\nf\r');
  });

  it('keeps lines apart that edits in two places leave in between', () => {
    const disk = 'a\rb\nc\rd\re\rf\n';
    expect(diskText('A\nb\nc\nd\ne\nF\n', disk)).toBe('A\rb\nc\rd\re\rF\r');
  });

  it('turns lines the editor ended with a LF into the file line break, CRLFs typed stay', () => {
    expect(diskText('a\nb\r\nc\n', mac('a', 'c'))).toBe('a\rb\r\nc\r');
  });
});

describe('crAgainstLf', () => {
  it('tells a file of lone CRs from one of LFs, both shown with LFs', () => {
    expect(crAgainstLf(mac('a'), unix('a'))).toBe(true);
    expect(crAgainstLf(unix('a'), mac('a'))).toBe(true);
  });

  it('is false when the LFs shown stand for the same line break, or can not tell', () => {
    expect(crAgainstLf(mac('a'), mac('b'))).toBe(false);
    expect(crAgainstLf(unix('a'), dos('a'))).toBe(false);
    expect(crAgainstLf(mac('a'), dos('a'))).toBe(false);
    expect(crAgainstLf(MIXED, unix('a'))).toBe(false);
    expect(crAgainstLf('', mac('a'))).toBe(false);
  });
});
