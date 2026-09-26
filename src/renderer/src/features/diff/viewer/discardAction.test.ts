import { describe, expect, it } from 'vitest';
import { describeDiscard, lineActionLabel, wholeChangeLabel } from './discardAction';

const removed = (lineNumber: number) => ({ side: 'deletions' as const, lineNumber });
const added = (lineNumber: number) => ({ side: 'additions' as const, lineNumber });

describe('describeDiscard', () => {
  it('restores removed lines', () => {
    expect(describeDiscard([removed(3)])).toEqual({ kind: 'restore', label: 'Restore 1 line', done: 'Restored 1 line' });
    expect(describeDiscard([removed(3), removed(4)]).label).toBe('Restore 2 lines');
  });

  it('removes added lines', () => {
    expect(describeDiscard([added(3), added(4), added(5)])).toEqual({
      kind: 'remove',
      label: 'Remove 3 lines',
      done: 'Removed 3 lines',
    });
  });

  it('reverts a change', () => {
    expect(describeDiscard([removed(3), added(3), added(4)])).toEqual({
      kind: 'revert',
      label: 'Revert 3 lines',
      done: 'Reverted 3 lines',
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
    expect(lineActionLabel(added(3))).toBe('Remove line');
    expect(lineActionLabel(removed(3))).toBe('Restore line');
  });
});
