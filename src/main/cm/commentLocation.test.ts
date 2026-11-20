import { describe, expect, it } from 'vitest';
import { commentedLinesOf, lineOption } from './commentLocation';

describe('commentedLinesOf', () => {
  it('reads one line, stored from 0', () => {
    expect(commentedLinesOf('11')).toEqual({ firstLine: 12, lastLine: 12 });
    expect(commentedLinesOf('0')).toEqual({ firstLine: 1, lastLine: 1 });
  });

  it('reads a range, both ends included', () => {
    expect(commentedLinesOf('lines:2-5')).toEqual({ firstLine: 3, lastLine: 6 });
    expect(commentedLinesOf('lines:7-7')).toEqual({ firstLine: 8, lastLine: 8 });
  });

  it('reads no lines in a comment on the whole file, or on no file', () => {
    expect(commentedLinesOf('-1')).toBeNull();
    expect(commentedLinesOf('')).toBeNull();
  });

  it("reads no lines in another client's location, or a range backwards", () => {
    expect(commentedLinesOf('image:120,80')).toBeNull();
    expect(commentedLinesOf('model:0.1,1.5,0;node=Body')).toBeNull();
    expect(commentedLinesOf('lines:5-2')).toBeNull();
    expect(commentedLinesOf('lines:2-')).toBeNull();
    expect(commentedLinesOf('lines:2-5;hint=x')).toBeNull();
  });

  it('reads past a line end a Windows cm prints', () => {
    expect(commentedLinesOf('lines:2-5\r')).toEqual({ firstLine: 3, lastLine: 6 });
  });
});

describe('lineOption', () => {
  it('names one line alone, and a range by its ends', () => {
    expect(lineOption({ firstLine: 42, lastLine: 42 })).toBe('--line=42');
    expect(lineOption({ firstLine: 12, lastLine: 18 })).toBe('--line=12-18');
  });
});
