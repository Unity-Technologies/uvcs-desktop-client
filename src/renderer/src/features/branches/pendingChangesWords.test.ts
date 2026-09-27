import { describe, expect, it } from 'vitest';
import { pendingChangesPronoun } from './pendingChangesWords';

describe('pendingChangesPronoun', () => {
  it('speaks of one change in the singular', () => {
    expect(pendingChangesPronoun(1)).toBe('it');
  });

  it('speaks of several changes in the plural', () => {
    expect(pendingChangesPronoun(2)).toBe('them');
    expect(pendingChangesPronoun(40)).toBe('them');
  });
});
