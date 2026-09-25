import type { CommandLogEntry } from '@shared/events';

/** A failure that still deserves attention: one no operation dealt with, logged after the log was last looked at. */
export function isUnseenFailure(entry: Pick<CommandLogEntry, 'id' | 'exitCode'>, seenUpTo: number, handledIds: ReadonlySet<number>): boolean {
  return entry.exitCode !== 0 && entry.id > seenUpTo && !handledIds.has(entry.id);
}
