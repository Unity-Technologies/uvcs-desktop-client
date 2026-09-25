import { describe, expect, it } from 'vitest';
import { describeDiscard, lineActionLabel, wholeChangeLabel } from './discardAction';

const removed = (lineNumber: number) => ({ side: 'deletions' as const, lineNumber });
const added = (lineNumber: number) => ({ side: 'additions' as const, lineNumber });

describe('describeDiscard', () => {
  it('restores removed lines', () => {
    expect(describeDiscard([removed(3)])).toEqual({ kind: 'restore', label: 'Restore 1 line', done: 'Restored 1 line', description: 'Put back the removed line' });
    expect(describeDiscard([removed(3), removed(4)]).label).toBe('Restore 2 lines');
  });

  it('removes added lines', () => {
    expect(describeDiscard([added(3), added(4), added(5)])).toEqual({
      kind: 'remove',
      label: 'Remove 3 lines',
      done: 'Removed 3 lines',
      description: 'Delete the 3 added lines',
    });
  });

  it('counts the original lines of a change', () => {
    expect(describeDiscard([removed(3), removed(4), added(3)]).description).toBe('Replace this line with the original 2 lines');
  });

  it('reverts a change', () => {
    expect(describeDiscard([removed(3), added(3), added(4)])).toEqual({
      kind: 'revert',
      label: 'Revert 3 lines',
      done: 'Reverted 3 lines',
      description: 'Replace these 2 lines with the original one',
    });
  });
});

describe('wholeChangeLabel', () => {
  it('reverts a change that replaces lines, and says what the others do', () => {
    expect(wholeChangeLabel([removed(3), added(3)])).toBe('Revert change');
    expect(wholeChangeLabel([added(3), added(4)])).toBe('Remove 2 lines');
    expect(wholeChangeLabel([removed(3)])).toBe('Restore 1 line');
  });
});

describe('lineActionLabel', () => {
  it('removes an added line and restores a removed one', () => {
    expect(lineActionLabel(added(3))).toBe('Remove this line');
    expect(lineActionLabel(removed(3))).toBe('Restore this line');
  });
});
