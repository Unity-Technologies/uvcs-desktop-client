import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { BURST_FILES, BURST_WINDOW_MS, freshlyChangedPaths, isBurst, recordSightings } from './changeBurst';

const file = (path: string, lastModified = 't0'): PendingChange => ({ path, kinds: ['changed'], itemType: 'file', size: 0, lastModified });
const paths = (count: number): string[] => Array.from({ length: count }, (_, index) => `f${index}.ts`);

describe('change bursts', () => {
  it('sees files that became pending or were written again, not folders or untouched files', () => {
    const folder: PendingChange = { ...file('src'), itemType: 'directory' };
    const previous = [file('a.ts'), file('b.ts')];
    expect(freshlyChangedPaths(previous, [file('a.ts'), file('b.ts', 't1'), file('c.ts'), folder])).toEqual(['b.ts', 'c.ts']);
  });

  it(`is a burst when ${BURST_FILES} different files change within the window`, () => {
    const almost = recordSightings([], paths(BURST_FILES - 1), 0);
    expect(isBurst(almost)).toBe(false);
    expect(isBurst(recordSightings(almost, ['f0.ts'], 1000))).toBe(false);
    expect(isBurst(recordSightings(almost, ['other.ts'], 1000))).toBe(true);
  });

  it('forgets changes older than the window', () => {
    const old = recordSightings([], paths(BURST_FILES - 1), 0);
    expect(isBurst(recordSightings(old, ['other.ts'], BURST_WINDOW_MS))).toBe(false);
  });
});
