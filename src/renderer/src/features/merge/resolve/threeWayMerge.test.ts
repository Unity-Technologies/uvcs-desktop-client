import { describe, expect, it } from 'vitest';
import { buildConflictDocument, countConflictRegions, hasConflictMarkers, resolveConflictRegion, resolveEveryConflictRegion } from './threeWayMerge';

const labels = { source: '/main/task', destination: '/main' };
const BASE = 'line1\nline2\nline3\nline4\nline5\n';

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

  it('merges files of lone CRs line by line, keeping their CRs', () => {
    const document = buildConflictDocument('a\rb\rc\rd\r', 'a\rb\rc\rD\r', 'A\rb\rc\rd\r', labels);
    expect(document).toEqual({ text: 'A\rb\rc\rD\r', conflictCount: 0 });
  });

  it('ends the markers of a file of lone CRs with CRs, so resolving leaves only CRs', () => {
    const document = buildConflictDocument('a\rb\rc\r', 'a\rS\rc\r', 'a\rD', labels);
    expect(document.text).toBe('a\r<<<<<<< /main\rD\r=======\rS\rc\r>>>>>>> /main/task\r');
    expect(countConflictRegions(document.text)).toBe(1);
    expect(resolveConflictRegion(document.text, 0, 'incoming')).toBe('a\rS\rc\r');
    expect(resolveEveryConflictRegion(document.text, 'both')).toBe('a\rD\rS\rc\r');
  });

  it("keeps each line's own line break in a file mixing CR, LF and CRLF", () => {
    const base = 'a\r\nb\nc\rd\r';
    expect(buildConflictDocument(base, 'a\r\nb\nc\rD\r', 'A\r\nb\nc\rd\r', labels).text).toBe('A\r\nb\nc\rD\r');
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

  it('resolves every region the same way at once', () => {
    expect(resolveEveryConflictRegion(twoConflicts, 'both')).toBe('a\nD1\nS1\nc\nD2\nS2\ne\n');
  });

  it('keeps Windows line endings inside the region', () => {
    const text = '<<<<<<< dst\r\nD\r\n=======\r\nS\r\n>>>>>>> src\r\n';
    expect(resolveConflictRegion(text, 0, 'incoming')).toBe('S\r\n');
  });
});

describe('hasConflictMarkers', () => {
  it('finds markers on lines broken by lone CRs', () => {
    expect(hasConflictMarkers('ok\r<<<<<<< dst\rD\r=======\rS\r>>>>>>> src\r')).toBe(true);
  });

  it('only matches markers at the start of a line', () => {
    expect(hasConflictMarkers('const x = "<<<<<<< not a marker";\n')).toBe(false);
    expect(hasConflictMarkers('ok\n>>>>>>> destination\n')).toBe(true);
  });
});
