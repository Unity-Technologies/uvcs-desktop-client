import { describe, expect, it } from 'vitest';
import { objectListLayout, objectListState } from './objectListState';

describe('objectListState', () => {
  it('shows a skeleton until rows are read, whatever the filters', () => {
    expect(objectListState({ loading: true, rowCount: 0, filtering: false })).toBe('loading');
    expect(objectListState({ loading: true, rowCount: 0, filtering: true })).toBe('loading');
  });

  it('lists the rows read', () => {
    expect(objectListState({ loading: false, rowCount: 3, filtering: true })).toBe('listed');
  });

  it('tells filters hiding every row apart from there being none', () => {
    expect(objectListState({ loading: false, rowCount: 0, filtering: true })).toBe('noMatches');
    expect(objectListState({ loading: false, rowCount: 0, filtering: false })).toBe('nothing');
  });
});

describe('objectListLayout', () => {
  it("shows the view's first-use state beside the empty list, or in it while the details are hidden", () => {
    expect(objectListLayout('nothing', false)).toEqual({ inList: null, inDetails: 'emptyState' });
    expect(objectListLayout('nothing', true)).toEqual({ inList: 'emptyState', inDetails: 'blank' });
  });

  it("shows the filters' notice under the column titles, the details hidden or not", () => {
    expect(objectListLayout('noMatches', false)).toEqual({ inList: 'noMatches', inDetails: 'blank' });
    expect(objectListLayout('noMatches', true)).toEqual({ inList: 'noMatches', inDetails: 'blank' });
  });

  it('shows the rows beside the focused one', () => {
    expect(objectListLayout('listed', true)).toEqual({ inList: null, inDetails: 'selected' });
  });
});
