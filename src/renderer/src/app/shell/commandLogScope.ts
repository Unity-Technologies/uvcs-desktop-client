import type { CommandLogEntry } from '@shared/events';

/**
 * Whether a command ran for the given workspace: `cm` resolves the workspace from the working directory,
 * so a command belongs to the workspace it ran in. Global commands (profiles, the workspace list,
 * lookups of other workspaces from the home screen) run elsewhere and don't.
 */
export function ranInWorkspace(entry: CommandLogEntry, workspacePath: string): boolean {
  const root = workspacePath.replace(/[\\/]+$/, '');
  if (entry.cwd === root) return true;
  return entry.cwd.startsWith(`${root}/`) || entry.cwd.startsWith(`${root}\\`);
}
