import { describe, expect, it } from 'vitest';
import { conflictBaseAt, decideConflict, initialDecision, remainingConflicts, resolutionOf } from './fileConflictDecision';
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
    expect(resolutionOf({ kind: 'wholeFile', side: 'destination' }, { source: 'incoming\n' })).toEqual({ choice: 'destination' });
  });

  it("carries the incoming text when it writes back byte for byte, so the merge needn't read it again", () => {
    expect(resolutionOf({ kind: 'wholeFile', side: 'source' }, { source: '\uFEFFcafé\r\n' })).toEqual({ choice: 'source', text: '\uFEFFcafé\r\n' });
    // Not UTF-8 (a Latin-1 é read as U+FFFD): only cm writes its bytes as they are.
    expect(resolutionOf({ kind: 'wholeFile', side: 'source' }, { source: 'caf\uFFFD\n' })).toEqual({ choice: 'source' });
  });

  it('carries the base text when it writes back byte for byte; else cm saves the base', () => {
    expect(resolutionOf({ kind: 'wholeFile', side: 'base' }, { base: 'before\r\n', source: 'after\n' })).toEqual({ choice: 'base', text: 'before\r\n' });
    expect(resolutionOf({ kind: 'wholeFile', side: 'base' }, { base: 'caf\uFFFD\n' })).toEqual({ choice: 'base' });
    expect(resolutionOf({ kind: 'wholeFile', side: 'base' })).toEqual({ choice: 'base' });
  });

  it('decides one conflict, carrying the bases of those left: the one decided goes', () => {
    const decision = initialDecision(buildConflictDocument('a\nb\nc\nd\ne\n', 'a\nS1\nc\nS2\ne\n', 'a\nD1\nc\nD2\ne\n', labels))!;
    expect([conflictBaseAt(decision, 0), conflictBaseAt(decision, 1)]).toEqual(['b\n', 'd\n']);

    const firstKept = decideConflict(decision, 0, 'incoming');
    expect(firstKept).toEqual({ kind: 'text', text: 'a\nS1\nc\n<<<<<<< dst\nD2\n=======\nS2\n>>>>>>> src\ne\n', conflictBases: ['d\n'] });
    expect(decideConflict(firstKept, 0, 'base')).toEqual({ kind: 'text', text: 'a\nS1\nc\nd\ne\n', conflictBases: [] });
  });

  it("keeps each conflict's own base when conflicts repeat the same sides over different bases", () => {
    const repeated = initialDecision(buildConflictDocument('x\n1\ny\n2\nz\n', 'x\nS\ny\nS\nz\n', 'x\nD\ny\nD\nz\n', labels))!;
    expect(decideConflict(decideConflict(repeated, 0, 'incoming'), 0, 'base').text).toBe('x\nS\ny\n2\nz\n');
    expect(decideConflict(decideConflict(repeated, 1, 'current'), 0, 'base').text).toBe('x\n1\ny\nD\nz\n');
  });

  it('knows no base once the text was edited by hand or in a tool, whose conflicts are no longer the merge\'s', () => {
    expect(conflictBaseAt({ kind: 'text', text: '<<<<<<< dst\nmine\n=======\nS\n>>>>>>> src\n', edited: true }, 0)).toBeUndefined();
    expect(conflictBaseAt({ kind: 'wholeFile', side: 'source' }, 0)).toBeUndefined();
  });

  it("knows no base once the text's conflicts and the bases carried no longer match", () => {
    expect(conflictBaseAt({ kind: 'text', text: '<<<<<<< dst\nD\n=======\nS\n>>>>>>> src\n', conflictBases: ['b\n', 'd\n'] }, 0)).toBeUndefined();
    expect(conflictBaseAt({ kind: 'text', text: '<<<<<<< dst\nD\n=======\nS\n>>>>>>> src\n', conflictBases: ['b\n'] }, 0)).toBe('b\n');
  });

  it('binary files start without a decision', () => {
    expect(initialDecision(undefined)).toBeUndefined();
    expect(resolutionOf(undefined)).toBeNull();
  });
});
