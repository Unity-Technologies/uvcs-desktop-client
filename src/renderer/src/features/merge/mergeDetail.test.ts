import { describe, expect, it } from 'vitest';
import { mergeDetailOf } from './mergeDetail';

const none = { hidesAll: false, shown: false, start: undefined, selectedGroup: false };

describe('mergeDetailOf', () => {
  it('shows the item selected', () => {
    expect(mergeDetailOf({ ...none, shown: true })).toBe('item');
  });

  it('shows the page loading while it finds where to start', () => {
    expect(mergeDetailOf({ ...none, start: 'loading' })).toBe('loading');
  });

  it('describes a group or folder row selected', () => {
    expect(mergeDetailOf({ ...none, selectedGroup: true })).toBe('group');
  });

  it('says nothing is selected otherwise', () => {
    expect(mergeDetailOf(none)).toBe('nothing');
  });

  it('stays blank while the filters hide every item, whatever is selected', () => {
    expect(mergeDetailOf({ hidesAll: true, shown: true, start: 'loading', selectedGroup: true })).toBe('hidden');
  });
});
