import { describe, expect, it } from 'vitest';
import {
  AXIS_LABEL_SPACING,
  AXIS_TEXT_INSET,
  axisLabelCandidates,
  bucketAround,
  bucketSize,
  bucketTitle,
  dateRange,
  shortDate,
  spacedAxisLabels,
  type TimelineCalendar,
} from './timelineCalendar';

const DAY = 86_400_000;
const utc: TimelineCalendar = { locale: 'en-US', offsetMinutes: () => 0 };
/** Two hours ahead of UTC, as Central Europe in summer. */
const plusTwo: TimelineCalendar = { locale: 'en-US', offsetMinutes: () => -120 };
const at = (iso: string) => Date.parse(iso);
/** Text as wide as 5 px a character. */
const measure = (text: string) => text.length * 5;

describe('bucketSize', () => {
  it('counts by the hour up to 10 days, by the day up to about 5 months, else by the week', () => {
    expect(bucketSize(7 * DAY)).toBe('hour');
    expect(bucketSize(90 * DAY)).toBe('day');
    expect(bucketSize(365 * DAY)).toBe('week');
  });
});

describe('bucketAround', () => {
  it('finds the hour, the day and the week (from Monday) holding a time', () => {
    const time = at('2026-09-03T14:25:00Z'); // a Thursday
    expect(bucketAround(time, 'hour', utc)).toEqual({ size: 'hour', start: at('2026-09-03T14:00:00Z'), end: at('2026-09-03T15:00:00Z') });
    expect(bucketAround(time, 'day', utc)).toEqual({ size: 'day', start: at('2026-09-03T00:00:00Z'), end: at('2026-09-04T00:00:00Z') });
    expect(bucketAround(time, 'week', utc)).toEqual({ size: 'week', start: at('2026-08-31T00:00:00Z'), end: at('2026-09-07T00:00:00Z') });
  });

  it('starts days at the local midnight', () => {
    // 23:30 UTC is already the next day two hours ahead.
    expect(bucketAround(at('2026-09-03T23:30:00Z'), 'day', plusTwo)).toEqual({ size: 'day', start: at('2026-09-03T22:00:00Z'), end: at('2026-09-04T22:00:00Z') });
  });
});

describe('dates', () => {
  it('writes days short, and a range as its two ends or one day alone', () => {
    expect(shortDate(at('2026-12-23T10:00:00Z'), utc)).toBe('Dec 23');
    expect(dateRange(at('2026-12-23T10:00:00Z'), at('2027-01-03T10:00:00Z'), utc)).toBe('Dec 23 – Jan 3');
    expect(dateRange(at('2026-12-23T10:00:00Z'), at('2026-12-23T18:00:00Z'), utc)).toBe('Dec 23');
  });

  it('titles a bucket by its size, in local time', () => {
    expect(bucketTitle(bucketAround(at('2026-09-03T14:25:00Z'), 'hour', plusTwo), plusTwo)).toBe('Thu, Sep 3, 4:00 PM');
    expect(bucketTitle(bucketAround(at('2026-09-03T14:25:00Z'), 'day', utc), utc)).toBe('Thursday, September 3, 2026');
    expect(bucketTitle(bucketAround(at('2026-09-03T14:25:00Z'), 'week', utc), utc)).toBe('Week of August 31, 2026');
  });
});

/** The candidates' labels as the strip shows them with room for all of them. */
const shown = (times: Float64Array) => spacedAxisLabels(axisLabelCandidates(times, utc), { xOf: (column) => column * 100, widthOf: measure, stripWidth: 10_000 }).map(({ text }) => text);

describe('axis labels', () => {
  it('name the range’s start, then each day where it begins in a short range', () => {
    const times = Float64Array.from([at('2026-09-01T09:00:00Z'), at('2026-09-01T15:00:00Z'), at('2026-09-02T08:00:00Z'), at('2026-09-04T08:00:00Z')]);
    expect(axisLabelCandidates(times, utc).map(({ column, text }) => [column, text])).toEqual([
      [0, 'Sep 1'],
      [2, 'Sep 2'],
      [3, 'Sep 4'],
    ]);
  });

  it('name months in a long range, January with its year', () => {
    const times = Float64Array.from([at('2026-11-20T09:00:00Z'), at('2026-12-02T09:00:00Z'), at('2026-12-20T09:00:00Z'), at('2027-01-05T09:00:00Z'), at('2027-02-01T09:00:00Z')]);
    expect(axisLabelCandidates(times, utc).map(({ column }) => column)).toEqual([0, 1, 3, 4]);
    expect(shown(times)).toEqual(['Nov 20', 'Dec', 'Jan 2027', 'Feb']);
  });

  it('say the year of a month in another year than the label shown before it, after a gap too', () => {
    const times = Float64Array.from([at('2025-04-20T09:00:00Z'), at('2025-05-02T09:00:00Z'), at('2026-03-01T09:00:00Z'), at('2026-06-01T09:00:00Z')]);
    expect(shown(times)).toEqual(['Apr 20', 'May', 'Mar 2026', 'Jun']);
  });

  it('say the year when the label of the new year was left out for room', () => {
    const times = Float64Array.from([at('2025-11-20T09:00:00Z'), at('2025-12-02T09:00:00Z'), at('2026-01-05T09:00:00Z'), at('2026-02-01T09:00:00Z')]);
    const xs = [0, 50, 60, 110];
    expect(spacedAxisLabels(axisLabelCandidates(times, utc), { xOf: (column) => xs[column]!, widthOf: measure, stripWidth: 10_000 }).map(({ text }) => text)).toEqual(['Nov 20', 'Dec', 'Feb 2026']);
  });

  it('name nothing for a changeset dated before the one to its left', () => {
    const times = Float64Array.from([at('2026-09-02T09:00:00Z'), at('2026-09-01T09:00:00Z'), at('2026-09-03T09:00:00Z')]);
    expect(axisLabelCandidates(times, utc).map(({ column }) => column)).toEqual([0, 2]);
    expect(axisLabelCandidates(new Float64Array(0), utc)).toEqual([]);
  });
});

describe('spacedAxisLabels', () => {
  it('keeps the first label, and each other one far enough from the last one kept', () => {
    const candidates = [0, 1, 2, 3].map((column) => ({ column, text: String(column), year: 2026, textWithYear: `${column} 2026` }));
    const xs = [0, 20, AXIS_LABEL_SPACING, AXIS_LABEL_SPACING + 10];
    // Each text starts 2 px into its day, and 4 px in from the strip's edge.
    expect(spacedAxisLabels(candidates, { xOf: (column) => xs[column]!, widthOf: measure, stripWidth: 1_000 })).toEqual([
      { x: AXIS_TEXT_INSET, text: '0' },
      { x: AXIS_LABEL_SPACING + 2, text: '2' },
    ]);
  });

  it('leaves out a label the text before it would run into', () => {
    const candidates = [0, 1, 2].map((column) => ({ column, text: 'Long label text', year: 2026, textWithYear: 'Long label text' }));
    const xs = [0, 60, 90];
    // 75 px of text and 8 px after it: the second starts too soon, the third clears it.
    expect(spacedAxisLabels(candidates, { xOf: (column) => xs[column]!, widthOf: measure, stripWidth: 1_000 }).map(({ x }) => x)).toEqual([AXIS_TEXT_INSET, 92]);
  });

  it('leaves out a date the strip’s right edge would cut', () => {
    const candidates = [0, 1].map((column) => ({ column, text: 'Sep', year: 2026, textWithYear: 'Sep 2026' }));
    // 'Sep' is 15 px: at 100 it ends at 117, past 120 − 4.
    const xs = [0, 104];
    expect(spacedAxisLabels(candidates, { xOf: (column) => xs[column]!, widthOf: measure, stripWidth: 120 }).map(({ x }) => x)).toEqual([AXIS_TEXT_INSET]);
    expect(spacedAxisLabels(candidates, { xOf: (column) => xs[column]!, widthOf: measure, stripWidth: 130 }).map(({ x }) => x)).toEqual([AXIS_TEXT_INSET, 106]);
  });
});
