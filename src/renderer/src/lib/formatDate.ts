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
