import '../../testing/fakeWindow';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import { everyBranchQuery, everyLabelQuery, recentShelvesQuery } from './paletteQueries';

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
});
