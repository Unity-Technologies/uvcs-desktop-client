const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function formatRelativeDate(isoDate: string, now = Date.now()): string {
  const seconds = (new Date(isoDate).getTime() - now) / 1000;
  if (Number.isNaN(seconds)) return '';

  for (const [unit, unitSeconds] of UNITS) {
    if (Math.abs(seconds) >= unitSeconds) return relativeFormatter.format(Math.round(seconds / unitSeconds), unit);
  }
  return 'just now';
}

export function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? isoDate : dateTimeFormatter.format(date);
}

/** Where a date is read: the user's locale and time zone (undefined), or the ones given, as tests do. */
export interface DayFormat {
  locale?: string;
  timeZone?: string;
}

/** A day in words ("October 30, 2026"), as a release is dated; none for a date it can't read. */
export function formatDay(isoDate: string, { locale, timeZone }: DayFormat = {}): string | null {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', year: 'numeric', timeZone }).format(date);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A moment as a compact list column says it, a few characters wide: "now", "12m", "3h", "2d" within a week, then its
 * day ("Oct 14"), or its month and year before this year ("Oct 2025"). A moment ahead of `now` (a server's clock
 * running ahead) is "now". The full date goes in a tooltip.
 */
export function formatShortAge(isoDate: string, now: number, { locale, timeZone }: DayFormat = {}): string {
  const time = Date.parse(isoDate);
  if (Number.isNaN(time)) return '';
  const age = Math.max(0, now - time);
  if (age < MINUTE) return 'now';
  if (age < HOUR) return `${Math.floor(age / MINUTE)}m`;
  if (age < DAY) return `${Math.floor(age / HOUR)}h`;
  if (age < 7 * DAY) return `${Math.floor(age / DAY)}d`;
  const options: Intl.DateTimeFormatOptions = isSameYear(time, now, timeZone) ? { month: 'short', day: 'numeric' } : { month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(time);
}

/** A day in a short line ("Nov 9"), with its year when it isn't this year ("Nov 9, 2025"); empty for a date it can't read. */
export function formatShortDay(isoDate: string, now: number, { locale, timeZone }: DayFormat = {}): string {
  const time = Date.parse(isoDate);
  if (Number.isNaN(time)) return '';
  const year: Intl.DateTimeFormatOptions = isSameYear(time, now, timeZone) ? {} : { year: 'numeric' };
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', ...year, timeZone }).format(time);
}

function isSameYear(a: number, b: number, timeZone: string | undefined): boolean {
  const year = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone });
  return year.format(a) === year.format(b);
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
