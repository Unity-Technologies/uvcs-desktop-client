import { describe, expect, it } from 'vitest';
import type { CommandLogEntry } from '@shared/events';
import { commandLogFilterTexts, commandLogRows, isFiltering, NO_FILTER } from './commandLogFilter';

const entry = (id: number, commandLine: string, fields: Partial<CommandLogEntry> = {}): CommandLogEntry => ({
  id,
  commandLine,
  cwd: '/work/game',
  startedAt: 0,
  durationMs: 1,
  exitCode: 0,
  viaShell: true,
  output: '',
  ...fields,
});

const log = {
  entries: [
    entry(11, 'cm status --xml'),
    entry(12, 'cm workspace list', { cwd: '/Users/me' }),
    entry(15, 'cm checkin -c=fix', { exitCode: 1, output: 'Error: the item is locked by ana' }),
    entry(16, 'cm find branch --format={name}'),
  ],
  firstNumber: 40,
};

const ids = (rows: { entry: CommandLogEntry }[]) => rows.map((row) => row.entry.id);

describe('commandLogFilterTexts', () => {
  it('takes the command line and output as shown, their control characters as pictures, and where it ran when shown', () => {
    const logged = entry(1, 'cm find --format={a}\u001f{b}', { output: 'bad\u001e' });
    expect(commandLogFilterTexts(logged)).toEqual(['cm find --format={a}␟{b}', 'bad␞']);
    expect(commandLogFilterTexts(logged, '/Users/me')).toEqual(['cm find --format={a}␟{b}', '/Users/me', 'bad␞']);
  });
});

describe('commandLogRows', () => {
  it('numbers each row by its place in the whole log, whatever the scope and filter hide', () => {
    const rows = commandLogRows(log, 'workspace', '/work/game', { query: 'find', failedOnly: false });
    expect(rows).toEqual([{ entry: log.entries[3], number: 43, cwd: undefined }]);
  });

  it('shows the commands of the workspace, or all of them with where the others ran', () => {
    expect(ids(commandLogRows(log, 'workspace', '/work/game', NO_FILTER))).toEqual([11, 15, 16]);
    const all = commandLogRows(log, 'all', '/work/game', NO_FILTER);
    expect(all.map((row) => row.cwd)).toEqual([undefined, '/Users/me', undefined, undefined]);
  });

  it('keeps rows with every word typed, in any order, in one of the texts it shows', () => {
    expect(ids(commandLogRows(log, 'all', '/work/game', { query: 'LOCKED checkin', failedOnly: false }))).toEqual([15]);
    expect(ids(commandLogRows(log, 'all', '/work/game', { query: 'users', failedOnly: false }))).toEqual([12]);
    expect(ids(commandLogRows(log, 'all', '/work/game', { query: 'status merge', failedOnly: false }))).toEqual([]);
  });

  it('never matches where a command ran when the row does not show it', () => {
    expect(ids(commandLogRows(log, 'all', '/work/game', { query: 'game', failedOnly: false }))).toEqual([]);
  });

  it('keeps failed commands only when asked', () => {
    expect(ids(commandLogRows(log, 'all', '/work/game', { query: '', failedOnly: true }))).toEqual([15]);
  });
});

describe('isFiltering', () => {
  it('is on with words typed or failed commands only', () => {
    expect(isFiltering(NO_FILTER)).toBe(false);
    expect(isFiltering({ query: '  ', failedOnly: false })).toBe(false);
    expect(isFiltering({ query: 'cm', failedOnly: false })).toBe(true);
    expect(isFiltering({ query: '', failedOnly: true })).toBe(true);
  });
});
