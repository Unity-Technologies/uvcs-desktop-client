import { describe, expect, it } from 'vitest';
import { objectListState } from './objectListState';

describe('objectListState', () => {
  it('shows a skeleton until rows are read, whatever the filters', () => {
    expect(objectListState(true, 0, false)).toBe('loading');
    expect(objectListState(true, 0, true)).toBe('loading');
  });

  it('lists the rows read', () => {
    expect(objectListState(false, 3, true)).toBe('listed');
  });

  it('tells filters hiding every row apart from there being none', () => {
    expect(objectListState(false, 0, true)).toBe('noMatches');
    expect(objectListState(false, 0, false)).toBe('nothing');
  });
});
