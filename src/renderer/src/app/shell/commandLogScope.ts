import type { CommandLogEntry } from '@shared/events';

/** Which commands the log shows: those of the open workspace, or every command the app ran. */
export type CommandLogScope = 'workspace' | 'all';

/**
 * Whether a command ran for the given workspace: `cm` resolves the workspace from the working directory,
 * so a command belongs to the workspace it ran in. Lookups of other workspaces from the home screen run elsewhere
 * and don't; local commands that answer the same anywhere (profiles, the workspace list: `anyDirectory`) run in a
 * workspace a window shows, and show among its commands.
 */
export function ranInWorkspace(entry: CommandLogEntry, workspacePath: string): boolean {
  const root = workspacePath.replace(/[\\/]+$/, '');
  if (entry.cwd === root) return true;
  return entry.cwd.startsWith(`${root}/`) || entry.cwd.startsWith(`${root}\\`);
}
