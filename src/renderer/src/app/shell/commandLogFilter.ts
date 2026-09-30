import type { CommandLogEntry } from '@shared/events';
import { withControlPictures } from '../../lib/controlPictures';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import type { NumberedLog } from './commandLogNumbering';
import { commandEnding } from './commandEnding';
import { ranInWorkspace, type CommandLogScope } from './commandLogScope';

export interface CommandLogFilter {
  query: string;
  failedOnly: boolean;
}

export const NO_FILTER: CommandLogFilter = { query: '', failedOnly: false };

export interface CommandLogRow {
  entry: CommandLogEntry;
  number: number;
  /** Where it ran, shown for commands of other workspaces or none. */
  cwd?: string;
}

export function isFiltering(filter: CommandLogFilter): boolean {
  return filter.failedOnly || filter.query.trim() !== '';
}

/**
 * The texts a row shows, as it shows them: the command line, where it ran when shown, and a failure's ending
 * (`commandEnding`) and output.
 */
export function commandLogFilterTexts(entry: CommandLogEntry, cwd?: string): string[] {
  const ending = entry.exitCode === 0 ? [] : [commandEnding(entry.exitCode)];
  return [withControlPictures(entry.commandLine), ...(cwd ? [cwd] : []), ...ending, withControlPictures(entry.output)];
}

/** The rows the log shows for the scope and the filter, each with its number in the whole log. */
export function commandLogRows(log: NumberedLog, scope: CommandLogScope, workspacePath: string, filter: CommandLogFilter): CommandLogRow[] {
  return log.entries.flatMap((entry, index) => {
    const inWorkspace = ranInWorkspace(entry, workspacePath);
    if (scope === 'workspace' && !inWorkspace) return [];
    if (filter.failedOnly && entry.exitCode === 0) return [];
    const cwd = inWorkspace ? undefined : entry.cwd;
    if (!matchesWordFilter(commandLogFilterTexts(entry, cwd), filter.query)) return [];
    return [{ entry, number: log.firstNumber + index, cwd }];
  });
}
