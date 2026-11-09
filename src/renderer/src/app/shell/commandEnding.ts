import type { CommandLogEntry } from '@shared/events';

/**
 * The exit code main logs for a command that ended without one of its own: `cm` not found, stopped on a prompt, or
 * timed out (`endedWithoutExitCode` in `CmClient`).
 */
const NO_EXIT_CODE = -1;

/** How a failed command ended, in words: "Stopped" when it had no exit code of its own, else "Exit code 1". */
export function commandEnding(exitCode: number): string {
  return exitCode === NO_EXIT_CODE ? 'Stopped' : `Exit code ${exitCode}`;
}

/**
 * How a failed entry ended, in words: a command by its exit code (`commandEnding`), an issue tracker's request by its
 * answer's status ("HTTP 404"), or "No answer" when none came.
 */
export function entryEnding(entry: Pick<CommandLogEntry, 'exitCode' | 'source' | 'httpStatus'>): string {
  if (entry.source !== 'tracker') return commandEnding(entry.exitCode);
  return entry.httpStatus === undefined ? 'No answer' : `HTTP ${entry.httpStatus}`;
}
