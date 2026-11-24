/**
 * An ISO 8601 date (`cm`'s round-trip format, `toISOString`) as milliseconds since the epoch; undefined for none or
 * for text that isn't a date: a list sorting by date compares numbers, and `NaN` compares as neither before nor after.
 */
export function parsedDate(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const milliseconds = Date.parse(text);
  return Number.isNaN(milliseconds) ? undefined : milliseconds;
}
