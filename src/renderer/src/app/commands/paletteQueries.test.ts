import '../../testing/fakeWindow';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import { recentChangesetsQuery, suggestedChangesetsQuery } from '../../features/changesets/recentChangesets';
import { everyBranchQuery, everyLabelQuery, recentShelvesQuery } from './paletteQueries';
import { branchSearchQuery, labelSearchQuery } from './usePaletteServerSearch';

const PLACE = workspacePlace('/work/game');

describe('the lists the palette and the suggestions share', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('read every branch and every label under the views’ keys', () => {
    expect(everyBranchQuery(PLACE).queryKey).toEqual(['workspace', '/work/game', 'branches', {}]);
    expect(everyLabelQuery(PLACE).queryKey).toEqual(['workspace', '/work/game', 'labels', {}]);
  });

  it('date the recent shelves at each call, so a reader after midnight shares the palette’s key of that day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 28, 23, 59));
    const before = recentShelvesQuery(PLACE).queryKey;
    vi.setSystemTime(new Date(2026, 9, 29, 0, 1));
    expect(recentShelvesQuery(PLACE).queryKey).not.toEqual(before);
    expect(recentShelvesQuery(PLACE).queryKey).toEqual(['workspace', '/work/game', 'shelves', { sinceDate: '2026-07-30' }]);
  });

  it('read the suggestions’ few newest changesets apart from the palette’s 2,000, and search a name under the palette’s search key', () => {
    expect(suggestedChangesetsQuery(PLACE).queryKey).toEqual(['workspace', '/work/game', 'changesets', { limit: 50 }]);
    expect(recentChangesetsQuery(PLACE).queryKey).toEqual(['workspace', '/work/game', 'changesets', { limit: 2000 }]);
    expect(branchSearchQuery(PLACE, 'fix-10').queryKey).toEqual(['workspace', '/work/game', 'branches', { text: 'fix-10', limit: 50 }]);
    expect(labelSearchQuery(PLACE, 'v1').queryKey).toEqual(['workspace', '/work/game', 'labels', { text: 'v1', limit: 50 }]);
  });
});
