import { describe, expect, it } from 'vitest';
import type { CommandLogEntry } from '@shared/events';
import { EMPTY_LOG, numberDigits, withEntry, type NumberedLog } from './commandLogNumbering';

const entry = (id: number): CommandLogEntry => ({ id, commandLine: `cm status ${id}`, cwd: '/work', startedAt: 0, durationMs: 1, exitCode: 0, viaShell: true, output: '' });

const logOf = (count: number, max: number): NumberedLog =>
  Array.from({ length: count }, (_, index) => entry(index + 1)).reduce((log, next) => withEntry(log, next, max), EMPTY_LOG);

describe('withEntry', () => {
  it('numbers entries from 1 in the order they came', () => {
    const log = logOf(3, 500);
    expect(log.entries.map((logged) => logged.id)).toEqual([1, 2, 3]);
    expect(log.firstNumber).toBe(1);
  });

  it('keeps the newest entries, each with its number, as older ones drop off', () => {
    const log = logOf(7, 5);
    expect(log.entries.map((logged) => logged.id)).toEqual([3, 4, 5, 6, 7]);
    expect(log.firstNumber).toBe(3);
  });
});

describe('numberDigits', () => {
  it('keeps room for three digits at least, so the gutter seldom grows', () => {
    expect(numberDigits(EMPTY_LOG)).toBe(3);
    expect(numberDigits(logOf(12, 500))).toBe(3);
  });

  it('fits the largest number in the log, not only those shown', () => {
    expect(numberDigits({ entries: logOf(500, 500).entries, firstNumber: 9_600 })).toBe(5);
    expect(numberDigits({ entries: logOf(2, 500).entries, firstNumber: 999 })).toBe(4);
  });
});
