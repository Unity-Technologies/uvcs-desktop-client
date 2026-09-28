import type { CommandLogEntry } from '@shared/events';

/**
 * The log's entries and the number of the first. An entry's number is its position in the log since it was last
 * cleared: it keeps it as older entries drop off, and whatever the scope or the filter hide.
 */
export interface NumberedLog {
  entries: CommandLogEntry[];
  firstNumber: number;
}

export const EMPTY_LOG: NumberedLog = { entries: [], firstNumber: 1 };

/** The log with `entry` last, keeping the newest `max` entries. */
export function withEntry(log: NumberedLog, entry: CommandLogEntry, max: number): NumberedLog {
  const dropped = Math.max(0, log.entries.length + 1 - max);
  return { entries: [...log.entries.slice(dropped), entry], firstNumber: log.firstNumber + dropped };
}

/** Digits the number gutter keeps room for: the log's largest number, at least three so it seldom grows. */
export function numberDigits(log: NumberedLog): number {
  return Math.max(3, String(log.firstNumber + log.entries.length - 1).length);
}
