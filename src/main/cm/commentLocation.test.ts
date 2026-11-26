import { describe, expect, it } from 'vitest';
import { commentedImageSpotOf, commentedLinesOf, imageLocationOption, lineOption } from './commentLocation';

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

describe('commentedImageSpotOf', () => {
  it('reads a point of an image, in its pixels', () => {
    expect(commentedImageSpotOf('image:120,80')).toEqual({ x: 120, y: 80 });
    expect(commentedImageSpotOf('image:0,0')).toEqual({ x: 0, y: 0 });
  });

  it('reads an area by its corner and its size', () => {
    expect(commentedImageSpotOf('image:120,80,200,140')).toEqual({ x: 120, y: 80, size: { width: 200, height: 140 } });
  });

  it("reads an SVG's decimals, and past the hints another client adds", () => {
    expect(commentedImageSpotOf('image:12.5,8.25')).toEqual({ x: 12.5, y: 8.25 });
    expect(commentedImageSpotOf('image:120,80;ink=M0%2C0L5%2C5')).toEqual({ x: 120, y: 80 });
    expect(commentedImageSpotOf('image:120,80\r')).toEqual({ x: 120, y: 80 });
  });

  it('reads no spot in lines, another kind, or numbers it would misplace', () => {
    expect(commentedImageSpotOf('11')).toBeNull();
    expect(commentedImageSpotOf('lines:2-5')).toBeNull();
    expect(commentedImageSpotOf('model:0.1,1.5,0')).toBeNull();
    expect(commentedImageSpotOf('image:120')).toBeNull();
    expect(commentedImageSpotOf('image:120,80,200')).toBeNull();
    expect(commentedImageSpotOf('image:120,80,0,140')).toBeNull();
    expect(commentedImageSpotOf('image:-5,80')).toBeNull();
    expect(commentedImageSpotOf('image:1e3,80')).toBeNull();
    expect(commentedImageSpotOf('image:1,5,80')).toBeNull();
    expect(commentedImageSpotOf('image:1,5;')).toEqual({ x: 1, y: 5 });
  });
});

describe('imageLocationOption', () => {
  it('writes a point, or an area by its corner and size, as whole pixels', () => {
    expect(imageLocationOption({ x: 120, y: 80 })).toBe('--location=image:120,80');
    expect(imageLocationOption({ x: 120, y: 80, size: { width: 200, height: 140 } })).toBe('--location=image:120,80,200,140');
    expect(imageLocationOption({ x: 1e-7, y: 3.6 })).toBe('--location=image:0,4');
  });

  it('writes what it reads back', () => {
    const spot = { x: 7, y: 9, size: { width: 3, height: 1 } };
    expect(commentedImageSpotOf(imageLocationOption(spot).slice('--location='.length))).toEqual(spot);
  });
});
