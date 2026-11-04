/**
 * The user's calendar as the Timeline reads it: where hours, days, weeks and months begin, and how dates are written.
 * Passed in, so tests read a fixed locale and time zone on every machine.
 */
export interface TimelineCalendar {
  /** The locale dates are written in; the user's when undefined. */
  locale?: string;
  /** Minutes the local time is behind UTC at an instant, as `Date.getTimezoneOffset` gives them. */
  offsetMinutes: (time: number) => number;
}

export const LOCAL_CALENDAR: TimelineCalendar = { offsetMinutes: (time) => new Date(time).getTimezoneOffset() };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The stretch of time the hover card counts: an hour, a day or a week, by how long a history is loaded. */
export type BucketSize = 'hour' | 'day' | 'week';

export interface Bucket {
  size: BucketSize;
  /** UTC ms, start included and end excluded. */
  start: number;
  end: number;
}

export function bucketSize(range: number): BucketSize {
  if (range <= 10 * DAY) return 'hour';
  return range <= 150 * DAY ? 'day' : 'week';
}

/** The local wall-clock time of an instant, as UTC ms: its calendar fields read with `getUTC*`. */
function local(calendar: TimelineCalendar, time: number): number {
  return time - calendar.offsetMinutes(time) * MINUTE;
}

/** The instant of a local wall-clock time. */
function instant(calendar: TimelineCalendar, wallClock: number): number {
  return wallClock + calendar.offsetMinutes(wallClock) * MINUTE;
}

/** The hour, day or week (from Monday) holding `time`. */
export function bucketAround(time: number, size: BucketSize, calendar: TimelineCalendar): Bucket {
  const wallClock = local(calendar, time);
  const day = Math.floor(wallClock / DAY) * DAY;
  if (size === 'hour') {
    const start = Math.floor(wallClock / HOUR) * HOUR;
    return { size, start: instant(calendar, start), end: instant(calendar, start + HOUR) };
  }
  if (size === 'day') return { size, start: instant(calendar, day), end: instant(calendar, day + DAY) };
  const monday = day - ((new Date(day).getUTCDay() + 6) % 7) * DAY;
  return { size, start: instant(calendar, monday), end: instant(calendar, monday + 7 * DAY) };
}

const formats = new Map<string, Intl.DateTimeFormat>();

/** Writes a local wall-clock time (read as UTC) in the calendar's locale. */
function write(calendar: TimelineCalendar, wallClock: number, options: Intl.DateTimeFormatOptions): string {
  const key = `${calendar.locale ?? ''}|${JSON.stringify(options)}`;
  let format = formats.get(key);
  if (!format) formats.set(key, (format = new Intl.DateTimeFormat(calendar.locale, { ...options, timeZone: 'UTC' })));
  return format.format(wallClock);
}

/** "Mar 3": a day in a range, a gap's ends. */
export function shortDate(time: number, calendar: TimelineCalendar): string {
  return write(calendar, local(calendar, time), { month: 'short', day: 'numeric' });
}

/** "Mar 3 – Mar 9", or one day alone. */
export function dateRange(from: number, to: number, calendar: TimelineCalendar): string {
  const first = shortDate(from, calendar);
  const last = shortDate(to, calendar);
  return first === last ? first : `${first} – ${last}`;
}

/** The hover card's title for a bucket: "Tue, Mar 3, 14:00", "Tuesday, March 3, 2026", "Week of March 2, 2026". */
export function bucketTitle(bucket: Bucket, calendar: TimelineCalendar): string {
  const start = local(calendar, bucket.start);
  switch (bucket.size) {
    case 'hour':
      return write(calendar, start, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    case 'day':
      return write(calendar, start, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    case 'week':
      return `Week of ${write(calendar, start, { month: 'long', day: 'numeric', year: 'numeric' })}`;
  }
}

/** Where the axis names a day or a month: at the column where it begins. */
export interface AxisLabel {
  column: number;
  text: string;
  /** Its local year, and how it reads in another year than the label shown before it ("Mar 2026"). */
  year: number;
  textWithYear: string;
}

/** Up to this long a range, the axis names days; longer, months. */
const DAY_LABELS_UP_TO = 45 * DAY;

/**
 * The days (short ranges) or months the axis can name, each at the first column in it, the first column always
 * named by its date (the range's start). Which of them fit is the strip's to decide (`spacedAxisLabels`).
 */
export function axisLabelCandidates(columnTimes: Float64Array, calendar: TimelineCalendar): AxisLabel[] {
  if (columnTimes.length === 0) return [];
  const range = columnTimes[columnTimes.length - 1]! - columnTimes[0]!;
  const byDay = range <= DAY_LABELS_UP_TO;
  const firstDay = Math.floor(local(calendar, columnTimes[0]!) / DAY);
  const start = shortDate(columnTimes[0]!, calendar);
  const labels: AxisLabel[] = [{ column: 0, text: start, year: yearOf(firstDay), textWithYear: start }];
  let previousMonth = monthOf(firstDay);
  // Most columns fall on the day of the one before: only one past the day's end reads the calendar again.
  let dayEnd = instant(calendar, (firstDay + 1) * DAY);
  for (let column = 1; column < columnTimes.length; column++) {
    // Columns go by id: a changeset dated before the one to its left names nothing.
    if (columnTimes[column]! < dayEnd) continue;
    const day = Math.floor(local(calendar, columnTimes[column]!) / DAY);
    dayEnd = instant(calendar, (day + 1) * DAY);
    if (byDay) {
      const text = shortDate(columnTimes[column]!, calendar);
      labels.push({ column, text, year: yearOf(day), textWithYear: text });
      continue;
    }
    const month = monthOf(day);
    if (month === previousMonth) continue;
    previousMonth = month;
    labels.push({
      column,
      text: write(calendar, day * DAY, { month: 'short' }),
      year: yearOf(day),
      textWithYear: write(calendar, day * DAY, { month: 'short', year: 'numeric' }),
    });
  }
  return labels;
}

function yearOf(day: number): number {
  return new Date(day * DAY).getUTCFullYear();
}

/** A local day's month, as a number that grows with it. */
function monthOf(day: number): number {
  const date = new Date(day * DAY);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

/** The axis's labels start at least this far apart (px), and leave at least `AXIS_LABEL_GAP` after the text before. */
export const AXIS_LABEL_SPACING = 38;
export const AXIS_LABEL_GAP = 8;
/**
 * A date starts this far right of where its day or month begins (a 1 px hairline there, then 4 px), and never closer
 * than `AXIS_TEXT_INSET` to an edge.
 */
const AXIS_TEXT_OFFSET = 5;
export const AXIS_TEXT_INSET = 4;

/** Where the strip's dates go, and how wide a date is drawn. */
export interface AxisLabelRoom {
  xOf: (column: number) => number;
  widthOf: (text: string) => number;
  stripWidth: number;
}

/** A date as drawn: its text from `x` (its left), after the hairline at `lineX` where its day or month begins; the first, the range's start, has none. */
export interface PlacedAxisLabel {
  x: number;
  lineX: number | null;
  text: string;
}

/**
 * The dates that fit, each where its text starts: the first always, each other one far enough from the last kept and
 * clear of its text, none cut by the right edge; one in another year than the date shown before it says its year
 * (January, or a month after a gap or a date left out).
 */
export function spacedAxisLabels(candidates: readonly AxisLabel[], { xOf, widthOf, stripWidth }: AxisLabelRoom): PlacedAxisLabel[] {
  const kept: PlacedAxisLabel[] = [];
  let shownYear: number | null = null;
  let freeFrom = Number.NEGATIVE_INFINITY;
  let lastStart = Number.NEGATIVE_INFINITY;
  for (const { column, text, year, textWithYear } of candidates) {
    const start = xOf(column);
    const x = Math.max(AXIS_TEXT_INSET, start + AXIS_TEXT_OFFSET);
    const shown = shownYear === null || year === shownYear ? text : textWithYear;
    const width = widthOf(shown);
    if (start - lastStart < AXIS_LABEL_SPACING || x < freeFrom || x + width > stripWidth - AXIS_TEXT_INSET) continue;
    kept.push({ x, lineX: kept.length === 0 ? null : Math.round(start), text: shown });
    shownYear = year;
    lastStart = start;
    freeFrom = x + width + AXIS_LABEL_GAP;
  }
  return kept;
}
