import { describe, expect, it } from 'vitest';
import { chosenConflictChoice, decisionFor, hasConflicts } from './conflictChoices';
import { buildConflictDocument } from './threeWayMerge';

const labels = { source: 'src', destination: 'dst' };
const document = buildConflictDocument('a\nb\nc\nd\ne\n', 'a\nS1\nc\nS2\ne\n', 'a\nD1\nc\nD2\ne\n', labels);

describe('conflict choices', () => {
  it('keeps a whole version, or both sides of every conflict', () => {
    expect(decisionFor('source', document)).toEqual({ kind: 'wholeFile', side: 'source' });
    expect(decisionFor('both', document)).toEqual({ kind: 'text', text: 'a\nD1\nS1\nc\nD2\nS2\ne\n' });
  });

  it('shows the choice the decision stands for', () => {
    expect(chosenConflictChoice('keepingDestination', { kind: 'wholeFile', side: 'destination' }, document)).toBe('destination');
    expect(chosenConflictChoice('combined', decisionFor('both', document), document)).toBe('both');
    expect(chosenConflictChoice('edited', { kind: 'text', text: 'x\n', edited: true }, document)).toBe('byHand');
  });

  it('shows none while undecided or when conflicts were picked one by one', () => {
    expect(chosenConflictChoice('needsDecision', { kind: 'text', text: document.text }, document)).toBeUndefined();
    expect(chosenConflictChoice('combined', { kind: 'text', text: 'a\nD1\nc\nS2\ne\n' }, document)).toBeUndefined();
  });

  it('tells files with conflicts from files merged automatically', () => {
    expect(hasConflicts(document)).toBe(true);
    expect(hasConflicts(buildConflictDocument('a\nb\nc\n', 'A\nb\nc\n', 'a\nb\nC\n', labels))).toBe(false);
    expect(hasConflicts(undefined)).toBe(false);
  });
});
