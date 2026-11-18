import type { CommandLogEntry } from '@shared/events';

/**
 * A failure that still deserves attention: one no operation dealt with, logged after the log was last looked at. A
 * command refused for a sign-in (`notRun`) isn't one: the sign-in screen already says.
 */
export function isUnseenFailure(entry: Pick<CommandLogEntry, 'id' | 'exitCode' | 'notRun'>, seenUpTo: number, handledIds: ReadonlySet<number>): boolean {
  return entry.exitCode !== 0 && !entry.notRun && entry.id > seenUpTo && !handledIds.has(entry.id);
}
