import { afterEach, describe, expect, it, vi } from 'vitest';
import { changesetToLookUp, createLookupSchedule, LOOKUP_DELAY_MS } from './changesetLookup';

describe('changesetToLookUp', () => {
  it('looks up a number the newest changesets don’t hold', () => {
    expect(changesetToLookUp('12', [{ label: '4207' }])).toBe(12);
  });

  it('looks nothing up for a number among them, or for words', () => {
    expect(changesetToLookUp('4207', [{ label: '4207' }])).toBeNull();
    expect(changesetToLookUp('switch', [])).toBeNull();
    expect(changesetToLookUp('', [])).toBeNull();
  });
});

describe('createLookupSchedule', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads one changeset for a number typed a digit at a time: the one typing stopped at', () => {
    vi.useFakeTimers();
    const lookups: (number | null)[] = [];
    const schedule = createLookupSchedule((id) => lookups.push(id));
    for (const typed of ['4', '42', '420', '4207']) {
      schedule.typed(changesetToLookUp(typed, []));
      vi.advanceTimersByTime(LOOKUP_DELAY_MS / 3);
    }
    vi.advanceTimersByTime(LOOKUP_DELAY_MS);
    expect(lookups).toEqual([4207]);
    schedule.stop();
  });

  it('reads nothing once the number is gone before typing stops', () => {
    vi.useFakeTimers();
    const lookups: (number | null)[] = [];
    const schedule = createLookupSchedule((id) => lookups.push(id));
    schedule.typed(12);
    schedule.typed(null);
    vi.advanceTimersByTime(LOOKUP_DELAY_MS * 2);
    expect(lookups).toEqual([null]);
    schedule.stop();
  });
});
