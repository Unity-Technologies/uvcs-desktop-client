import { describe, expect, it } from 'vitest';
import { changesDiffs, changesPanesState } from './changesPanesState';

describe('changesPanesState', () => {
  it('shows a skeleton until the changes are read', () => {
    expect(changesPanesState(undefined, 0)).toBe('reading');
  });

  it('says nothing is pending once none were read, whatever the filter', () => {
    expect(changesPanesState(0, 0)).toBe('nothingPending');
  });

  it('tells the filter hides every change apart from nothing being pending', () => {
    expect(changesPanesState(5, 0)).toBe('noMatches');
  });

  it('lists the changes the filter lets through', () => {
    expect(changesPanesState(5, 2)).toBe('listed');
  });
});

describe('changesDiffs', () => {
  it('has no diff to keep expanded once nothing is pending, or the filter hides every change', () => {
    expect(changesDiffs('nothingPending')).toBe('none');
    expect(changesDiffs('noMatches')).toBe('none');
  });

  it('is still reading, or lists changes to diff', () => {
    expect(changesDiffs('reading')).toBe('reading');
    expect(changesDiffs('listed')).toBe('some');
  });
});
