import { describe, expect, it } from 'vitest';
import { buildConflictDocument, countConflictRegions, hasConflictMarkers, resolveConflictRegion, splitLines } from './threeWayMerge';

const labels = { source: '/main/task', destination: '/main' };
const BASE = 'line1\nline2\nline3\nline4\nline5\n';

describe('splitLines', () => {
  it('keeps line terminators so the text can be rebuilt exactly', () => {
    expect(splitLines('a\r\nb\nc')).toEqual(['a\r\n', 'b\n', 'c']);
    expect(splitLines('')).toEqual([]);
    expect(splitLines('a\nb\n').join('')).toBe('a\nb\n');
  });
});

describe('buildConflictDocument', () => {
  it('applies non-overlapping changes from both sides without conflicts', () => {
    const document = buildConflictDocument(BASE, 'line1 SRC\nline2\nline3\nline4\nline5\n', 'line1\nline2\nline3\nline4\nline5 DST\n', labels);
    expect(document).toEqual({ text: 'line1 SRC\nline2\nline3\nline4\nline5 DST\n', conflictCount: 0 });
  });

  it('wraps overlapping changes in markers, destination (current) first', () => {
    const document = buildConflictDocument('a\nb\nc\n', 'a\nS\nc\n', 'a\nD\nc\n', labels);
    expect(document.conflictCount).toBe(1);
    expect(document.text).toBe('a\n<<<<<<< /main\nD\n=======\nS\n>>>>>>> /main/task\nc\n');
    expect(hasConflictMarkers(document.text)).toBe(true);
  });

  it('does not report the same change on both sides as a conflict', () => {
    expect(buildConflictDocument('a\nb\n', 'a\nB\n', 'a\nB\n', labels)).toEqual({ text: 'a\nB\n', conflictCount: 0 });
  });

  it('treats content added on both sides of an empty base as a conflict', () => {
    expect(buildConflictDocument('', 'x\n', 'y\n', labels).conflictCount).toBe(1);
  });

  it('keeps markers on their own line when a side has no final newline', () => {
    const document = buildConflictDocument('a\nb', 'a\nS', 'a\nD', labels);
    expect(document.text).toBe('a\n<<<<<<< /main\nD\n=======\nS\n>>>>>>> /main/task\n');
  });

  it('keeps Windows line endings of merged lines', () => {
    const document = buildConflictDocument('a\r\nb\r\n', 'a\r\nb\r\nc\r\n', 'z\r\nb\r\n', labels);
    expect(document.text).toBe('z\r\nb\r\nc\r\n');
  });
});

describe('resolveConflictRegion', () => {
  const twoConflicts = buildConflictDocument('a\nb\nc\nd\ne\n', 'a\nS1\nc\nS2\ne\n', 'a\nD1\nc\nD2\ne\n', labels).text;

  it('keeps the chosen side of one region and leaves the others untouched', () => {
    const resolved = resolveConflictRegion(twoConflicts, 1, 'incoming');
    expect(resolved).toBe('a\n<<<<<<< /main\nD1\n=======\nS1\n>>>>>>> /main/task\nc\nS2\ne\n');
    expect(countConflictRegions(resolved)).toBe(1);
  });

  it('keeps the current side', () => {
    expect(resolveConflictRegion(resolveConflictRegion(twoConflicts, 0, 'current'), 0, 'current')).toBe('a\nD1\nc\nD2\ne\n');
  });

  it('keeps both sides, current first', () => {
    expect(resolveConflictRegion(buildConflictDocument('a\n', 'S\n', 'D\n', labels).text, 0, 'both')).toBe('D\nS\n');
  });

  it('keeps Windows line endings inside the region', () => {
    const text = '<<<<<<< dst\r\nD\r\n=======\r\nS\r\n>>>>>>> src\r\n';
    expect(resolveConflictRegion(text, 0, 'incoming')).toBe('S\r\n');
  });
});

describe('hasConflictMarkers', () => {
  it('only matches markers at the start of a line', () => {
    expect(hasConflictMarkers('const x = "<<<<<<< not a marker";\n')).toBe(false);
    expect(hasConflictMarkers('ok\n>>>>>>> destination\n')).toBe(true);
  });
});
