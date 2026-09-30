import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { BURST_FILES, BURST_WINDOW_MS, freshlyChangedPaths, isBurst, recordSightings, watchRead } from './changeBurst';

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

describe('watchRead', () => {
  const files = (count: number, lastModified = 't0') => paths(count).map((path) => file(path, lastModified));

  it('takes the first read as where things stand, however many files it holds', () => {
    expect(watchRead(null, '/ws', files(50), 0).burst).toBe(false);
  });

  it('offers review once enough files change after the first read, and keeps offering it', () => {
    const first = watchRead(null, '/ws', [], 0);
    const burst = watchRead(first, '/ws', files(BURST_FILES), 1000);
    const calm = watchRead(burst, '/ws', files(BURST_FILES), 10 * BURST_WINDOW_MS);

    expect([first.burst, burst.burst, calm.burst]).toEqual([false, true, true]);
  });

  it('starts over on another workspace', () => {
    const burst = watchRead(watchRead(null, '/ws', [], 0), '/ws', files(BURST_FILES), 1000);

    expect(watchRead(burst, '/other', files(BURST_FILES, 't1'), 2000).burst).toBe(false);
  });
});
