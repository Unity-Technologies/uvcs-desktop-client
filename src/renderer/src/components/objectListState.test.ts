import { describe, expect, it } from 'vitest';
import { objectListState } from './objectListState';

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
