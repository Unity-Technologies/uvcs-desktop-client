import { describe, expect, it } from 'vitest';
import { initialDecision, remainingConflicts, resolutionOf } from './fileConflictDecision';
import { buildConflictDocument } from './threeWayMerge';

const labels = { source: 'src', destination: 'dst' };

describe('file conflict decisions', () => {
  it('resolves automatically merged files right away', () => {
    const decision = initialDecision(buildConflictDocument('a\nb\nc\n', 'A\nb\nc\n', 'a\nb\nC\n', labels));
    expect(resolutionOf(decision)).toEqual({ choice: 'text', text: 'A\nb\nC\n' });
    expect(remainingConflicts(decision)).toBe(0);
  });

  it('needs the user while conflict markers remain', () => {
    const decision = initialDecision(buildConflictDocument('a\n', 'S\n', 'D\n', labels));
    expect(resolutionOf(decision)).toBeNull();
    expect(remainingConflicts(decision)).toBe(1);
  });

  it('accepts text once the user removed every marker', () => {
    expect(resolutionOf({ kind: 'text', text: 'S\nD\n' })).toEqual({ choice: 'text', text: 'S\nD\n' });
  });

  it('keeps a whole version of the file', () => {
    expect(resolutionOf({ kind: 'wholeFile', side: 'source' })).toEqual({ choice: 'source' });
    expect(resolutionOf({ kind: 'wholeFile', side: 'destination' }, 'incoming\n')).toEqual({ choice: 'destination' });
  });

  it("carries the incoming text when it writes back byte for byte, so the merge needn't read it again", () => {
    expect(resolutionOf({ kind: 'wholeFile', side: 'source' }, '\uFEFFcafé\r\n')).toEqual({ choice: 'source', text: '\uFEFFcafé\r\n' });
    // Not UTF-8 (a Latin-1 é read as U+FFFD): only cm writes its bytes as they are.
    expect(resolutionOf({ kind: 'wholeFile', side: 'source' }, 'caf\uFFFD\n')).toEqual({ choice: 'source' });
  });

  it('binary files start without a decision', () => {
    expect(initialDecision(undefined)).toBeUndefined();
    expect(resolutionOf(undefined)).toBeNull();
  });
});
