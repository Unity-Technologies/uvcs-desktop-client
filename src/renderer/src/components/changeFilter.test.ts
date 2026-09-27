import { describe, expect, it } from 'vitest';
import { changeFilterPlaceholder, countTones, matchesChangeFilter, offeredTones } from './changeFilter';

describe('offeredTones', () => {
  it('always offers the common statuses and adds the others only when present', () => {
    expect(offeredTones(new Set())).toEqual(['changed', 'moved', 'deleted', 'added']);
    expect(offeredTones(new Set(['muted', 'private', 'permissions']))).toEqual(['changed', 'moved', 'deleted', 'permissions', 'added', 'private', 'muted']);
  });
});

describe('matchesChangeFilter', () => {
  it('matches everything when nothing is set', () => {
    expect(matchesChangeFilter('src/a.ts', 'added', { query: '', tones: new Set() })).toBe(true);
  });

  it('matches the path ignoring case and surrounding spaces', () => {
    expect(matchesChangeFilter('src/App.ts', 'added', { query: ' app ', tones: new Set() })).toBe(true);
    expect(matchesChangeFilter('src/App.ts', 'added', { query: 'lib', tones: new Set() })).toBe(false);
  });

  it('takes each word on its own, as the rows highlight them', () => {
    expect(matchesChangeFilter('src/ui/LoginButton.tsx', 'added', { query: 'button src', tones: new Set() })).toBe(true);
    expect(matchesChangeFilter('src/ui/LoginButton.tsx', 'added', { query: 'button lib', tones: new Set() })).toBe(false);
  });

  it('keeps only the chosen statuses', () => {
    const filter = { query: '', tones: new Set(['added', 'deleted'] as const) };
    expect(matchesChangeFilter('a', 'deleted', filter)).toBe(true);
    expect(matchesChangeFilter('a', 'changed', filter)).toBe(false);
  });
});

describe('countTones', () => {
  it('counts the changes of each status', () => {
    expect(countTones(['changed', 'private', 'changed', 'added'])).toEqual(new Map([['changed', 2], ['private', 1], ['added', 1]]));
  });
});

describe('changeFilterPlaceholder', () => {
  it('counts the files in the right number', () => {
    expect(changeFilterPlaceholder(1)).toBe('Filter 1 file');
    expect(changeFilterPlaceholder(0)).toBe('Filter 0 files');
    expect(changeFilterPlaceholder(1204)).toBe('Filter 1,204 files');
  });
});
