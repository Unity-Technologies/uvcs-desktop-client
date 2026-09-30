import { describe, expect, it } from 'vitest';
import { historyRead } from './historyRead';

const now = new Date(2026, 8, 25);

describe('historyRead', () => {
  it('asks for the history since the first day of the range, hidden branches only when shown', () => {
    expect(historyRead('lastWeek', false, now).query).toEqual({ sinceDate: '2026-09-18', includeHidden: false });
    expect(historyRead('lastMonth', true, now).query).toEqual({ sinceDate: '2026-08-26', includeHidden: true });
  });

  it('re-reads a date range when the window comes back, never all history', () => {
    expect(historyRead('lastMonth', false, now).rereadOnFocus).toBe(true);
    expect(historyRead('anyTime', false, now)).toEqual({ query: { sinceDate: undefined, includeHidden: false }, rereadOnFocus: false });
  });

  it('asks the same for the same range read on the same day, so the history is shared', () => {
    expect(historyRead('lastMonth', false, new Date(2026, 8, 25, 9)).query).toEqual(historyRead('lastMonth', false, new Date(2026, 8, 25, 18)).query);
  });
});
