import { describe, expect, it } from 'vitest';
import { countCalls } from '@shared/testing/countCalls';
import { layoutGraph } from '../model/layoutGraph';
import { activityCurve, activityHalfWindow, BLUR_SIGMA, historyPixels, columnActivity, gaussianBlur, percentile, perPixelMean, SHARE_MIN_HEIGHT, shareHeight } from './activityCurve';
import { sortedSearch } from './sortedSearch';
import { stripXOfColumn, TIMELINE_INSET, timelineAxis, type TimelineAxis } from './timelineAxis';
import { datedHistory, datesEvery } from './timelineFixtures';
import { timelineHistory, timelineShare } from './timelineHistory';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('activityHalfWindow', () => {
  it('counts ±1 h around a changeset for a week, ±12 h for three months, ±3.5 days for a year', () => {
    expect(activityHalfWindow(7 * DAY)).toBeCloseTo(HOUR);
    expect(activityHalfWindow(91 * DAY)).toBeCloseTo(12 * HOUR);
    expect(activityHalfWindow(365 * DAY)).toBeCloseTo(3.5 * DAY);
  });

  it('grows smoothly with the range between them, and with it past them', () => {
    const month = activityHalfWindow(30 * DAY);
    expect(month).toBeGreaterThan(HOUR);
    expect(month).toBeLessThan(12 * HOUR);
    expect(activityHalfWindow(730 * DAY)).toBeCloseTo(7 * DAY);
    expect(activityHalfWindow(DAY)).toBeCloseTo(HOUR / 7);
    expect(activityHalfWindow(0)).toBeGreaterThan(0);
  });
});

describe('columnActivity', () => {
  it('counts, for each column, the changesets within the window of its time', () => {
    const times = Float64Array.from([0, 10, 20, 100]);
    // Within the history, a plain count; at its ends, a rate over the half of the window inside it.
    expect([...columnActivity(times, times, 10, { start: -100, end: 200 })]).toEqual([2, 3, 2, 1]);
    expect([...columnActivity(times, times, 10, { start: 0, end: 100 })]).toEqual([4, 3, 2, 2]);
  });
});

describe('perPixelMean', () => {
  /** Columns land at world 56 + 64 × column; with this axis, 1 world px is 1 strip px. */
  const axis: TimelineAxis = { worldWidth: 400, width: 400, inset: 0, columnCount: 4 };

  it('takes the mean of the columns in a pixel', () => {
    // 640 world px per strip px: the four columns (world 56 to 248) all fall in the first pixel.
    const crowded: TimelineAxis = { worldWidth: 64_000, width: 100, inset: 0, columnCount: 4 };
    expect(perPixelMean(Float64Array.from([2, 4, 6, 8]), crowded)[0]).toBe(5);
  });

  it('draws a straight line between columns farther apart than a pixel, and nothing outside the history', () => {
    const values = perPixelMean(Float64Array.from([0, 64]), axis);
    expect(values[56]).toBe(0);
    expect(values[88]).toBe(32);
    expect(values[120]).toBe(64);
    expect(values[10]).toBe(0);
    expect(values[200]).toBe(0);
  });
});

describe('gaussianBlur', () => {
  it('keeps a flat curve flat, to its ends', () => {
    expect([...gaussianBlur(new Float64Array(20).fill(3), BLUR_SIGMA)].every((value) => Math.abs(value - 3) < 1e-9)).toBe(true);
  });

  it('spreads a spike evenly to both sides, keeping its weight', () => {
    const spike = new Float64Array(41);
    spike[20] = 1;
    const blurred = gaussianBlur(spike, BLUR_SIGMA);
    expect(blurred[17]).toBeCloseTo(blurred[23]!);
    expect(blurred[20]).toBeGreaterThan(blurred[17]!);
    expect(blurred.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
  });
});

describe('percentile', () => {
  it('reads the values above zero', () => {
    const values = Float64Array.from([0, 0, ...Array.from({ length: 100 }, (_, index) => index + 1)]);
    expect(percentile(values, 0.98)).toBe(98);
    expect(percentile(new Float64Array(5), 0.98)).toBe(0);
  });
});

describe('activityCurve', () => {
  // Busy weekdays and a quiet weekend, by two people: about 3 months.
  const dates = datesEvery('2026-06-01T08:00:00Z', 900, 140);
  const entries = dates.map((date, index) => ({ date, owner: index % 50 === 0 ? 'me' : 'ana' }));
  const layout = layoutGraph(datedHistory(entries));
  const history = timelineHistory(layout);
  const axis = timelineAxis(layout, 600);

  it('stands between 0 and 1 of the plot, the top at the 98th percentile', () => {
    const curve = activityCurve(history, timelineShare(history, new Set(['me'])), axis);
    expect(curve.total.length).toBe(600);
    expect(Math.max(...curve.total)).toBe(1);
    expect(Math.min(...curve.total)).toBeGreaterThanOrEqual(0);
  });

  it('keeps the share under the curve, in the same scale', () => {
    const curve = activityCurve(history, timelineShare(history, new Set(['me'])), axis);
    for (let pixel = 0; pixel < curve.total.length; pixel++) expect(curve.share[pixel]).toBeLessThanOrEqual(curve.total[pixel]! + 1e-9);
    const everyone = activityCurve(history, timelineShare(history, new Set(['me', 'ana'])), axis);
    expect([...everyone.share]).toEqual([...everyone.total]);
  });

  it('gives the share 2.5 px wherever they have a changeset, however few, and nothing elsewhere', () => {
    const lonely = layoutGraph(datedHistory(dates.map((date, index) => ({ date, owner: index === 450 ? 'me' : 'ana' }))));
    const lonelyHistory = timelineHistory(lonely);
    const lonelyAxis = timelineAxis(lonely, 600);
    const curve = activityCurve(lonelyHistory, timelineShare(lonelyHistory, new Set(['me'])), lonelyAxis);
    const mine = Math.floor(stripXOfColumn(lonelyAxis, 450));
    expect(shareHeight(curve, mine, 38)).toBeGreaterThanOrEqual(SHARE_MIN_HEIGHT);
    expect(curve.sharePresent.reduce((sum, value) => sum + value, 0)).toBe(1);
    expect(shareHeight(curve, 10, 38)).toBeLessThan(SHARE_MIN_HEIGHT);
  });

  it('keeps a steady history’s height to its last changeset, the empty ends of the strip never blurred in', () => {
    const steady = layoutGraph(datedHistory(datesEvery('2026-06-01T08:00:00Z', 2_000, 60)));
    const steadyAxis = timelineAxis(steady, 600);
    expect(steadyAxis.inset).toBe(TIMELINE_INSET);
    const curve = activityCurve(timelineHistory(steady), timelineShare(timelineHistory(steady), new Set()), steadyAxis);
    const { first, last } = historyPixels(steadyAxis, steady.columnCount);
    const middle = curve.total[Math.floor((first + last) / 2)]!;
    expect(curve.total[last]).toBeGreaterThan(middle * 0.9);
    expect(curve.total[first]).toBeGreaterThan(middle * 0.9);
    expect(curve.total[last + 2]).toBe(0);
  });

  it('is empty for a strip not laid out yet', () => {
    const curve = activityCurve(history, timelineShare(history, new Set()), timelineAxis(layout, 0));
    expect(curve.total.length).toBe(0);
  });

  it('counts the changesets a "+N" node holds where they were made', () => {
    // /main/task's middle changesets fold into one node: the busy hour still counts all of them.
    const busy = datedHistory([
      '2026-06-01T08:00:00Z',
      { date: '2026-06-03T10:00:00Z', branch: '/main/task' },
      ...datesEvery('2026-06-03T10:05:00Z', 8, 5).map((date) => ({ date, branch: '/main/task' })),
      { date: '2026-06-03T11:00:00Z', branch: '/main/task' },
      '2026-06-08T08:00:00Z',
    ]);
    const folded = timelineHistory(layoutGraph(busy, { keep: new Set() }));
    const whole = timelineHistory(layoutGraph(busy));
    expect(folded.columnTimes.length).toBeLessThan(whole.columnTimes.length);
    const window = activityHalfWindow(folded.end - folded.start);
    expect(columnActivity(folded.columnTimes, folded.times, window, folded)[2]).toBe(columnActivity(whole.columnTimes, whole.times, window, whole)[2]);
  });

  it('measures each column with one search of each end of its window, for the curve and the share, at scale', () => {
    const big = layoutGraph(datedHistory(datesEvery('2025-01-01T00:00:00Z', 12_000, 44)));
    const bigHistory = timelineHistory(big);
    const share = timelineShare(bigHistory, new Set(['me']));
    const { calls } = countCalls(sortedSearch, 'lowerBound', () => activityCurve(bigHistory, share, timelineAxis(big, 1_200)));
    expect(calls).toBe(2 * big.columnCount);
  });
});
