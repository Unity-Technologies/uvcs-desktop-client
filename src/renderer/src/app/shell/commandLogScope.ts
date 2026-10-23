import type { Place } from '@shared/domain/place';
import type { CommandLogEntry } from '@shared/events';

/** Which commands the log shows: those of the window's place, or every command the app ran. */
export type CommandLogScope = 'place' | 'all';

/** The log's scopes as its switch names them, "This workspace" or "This repository" for the place's. */
export function commandLogScopes(place: Place): { value: CommandLogScope; label: string; title: string }[] {
  const own = place.kind === 'workspace' ? 'workspace' : 'repository';
  return [
    { value: 'place', label: `This ${own}`, title: `Commands that ran for this ${own}` },
    { value: 'all', label: 'All', title: 'Every command the app ran, including lookups of other workspaces and servers' },
  ];
}

/**
 * Whether a command ran for the place. A workspace's: `cm` resolves the workspace from the working directory, so a
 * command belongs to the workspace it ran in. Commands that answer the same in any directory (the profiles, the
 * workspace list, glances at other workspaces: `anyDirectory`) run in a directory a window shows and show in the log
 * of whichever workspace that is; on the home screen they run in the home folder, in no workspace's log. A
 * repository explored without a workspace's: those run outside every workspace (`CommandLogEntry.outsideWorkspaces`),
 * as each of its commands names it; a window's log only gets its own commands, so another repository's aren't there.
 */
export function ranInPlace(entry: CommandLogEntry, place: Place): boolean {
  if (place.kind === 'repository') return entry.outsideWorkspaces === true;
  const root = place.workspacePath.replace(/[\\/]+$/, '');
  if (entry.cwd === root) return true;
  return entry.cwd.startsWith(`${root}/`) || entry.cwd.startsWith(`${root}\\`);
}
