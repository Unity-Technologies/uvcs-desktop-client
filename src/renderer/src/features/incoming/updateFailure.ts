import type { FailedCommand } from '@shared/ipc';

const STOPPED_BY_CONFLICTS = /The update operation detected conflicts/i;

/**
 * `cm update --dontmerge` stopped because local changes collide with incoming ones: files changed on both sides,
 * or files changed locally that the branch deleted or moved. Incoming is where both are sorted out.
 */
export function updateStoppedByConflicts(command: FailedCommand | undefined): boolean {
  return Boolean(command && command.exitCode !== 0 && STOPPED_BY_CONFLICTS.test(command.output));
}
