import type { CommandLogEntry } from '@shared/events';

/** Which commands the log shows: those of the open workspace, or every command the app ran. */
export type CommandLogScope = 'workspace' | 'all';

/**
 * Whether a command ran for the given workspace: `cm` resolves the workspace from the working directory,
 * so a command belongs to the workspace it ran in. Commands that answer the same in any directory (the profiles, the
 * workspace list, glances at other workspaces: `anyDirectory`) run in a directory a window shows and show in the log
 * of whichever workspace that is; on the home screen they run in the home folder, in no workspace's log.
 */
export function ranInWorkspace(entry: CommandLogEntry, workspacePath: string): boolean {
  const root = workspacePath.replace(/[\\/]+$/, '');
  if (entry.cwd === root) return true;
  return entry.cwd.startsWith(`${root}/`) || entry.cwd.startsWith(`${root}\\`);
}
