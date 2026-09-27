import { describe, expect, it } from 'vitest';
import { appliedShelveMessage, setAsideComment } from './shelveMessages';

describe('appliedShelveMessage', () => {
  it('tells applying from restoring, which deletes the shelve', () => {
    expect(appliedShelveMessage(12, 3, false)).toBe('Applied 3 changes from shelve 12');
    expect(appliedShelveMessage(12, 1, true)).toBe('Restored 1 change from shelve 12');
  });

  it('says when the workspace already had the changes', () => {
    expect(appliedShelveMessage(12, 0, false)).toBe('Shelve 12 had nothing new to apply');
    expect(appliedShelveMessage(12, 0, true)).toBe('Deleted shelve 12: its changes were here already');
  });
});

describe('setAsideComment', () => {
  it('names the shelve the changes made way for', () => {
    expect(setAsideComment(12)).toBe('Set aside to apply shelve 12');
  });
});
