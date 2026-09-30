import type { AppSettings } from '@shared/domain/settings';
import type { EarlyCalls } from '../ipc/EarlyCalls';

/**
 * Starts the reads the first window's first screen makes as its page loads, before the window is created: their `cm`
 * commands then run while the window and its page load (a few hundred ms at start-up), and the page's own calls take
 * their answers (`EarlyCalls`). They are the calls `prefetchStartupQueries` makes in the page, with the arguments it
 * makes them with; one that differs is simply read again. The workspace's (`workspacePath`): its info and pending
 * changes, filtered as the settings say; the home screen's: the workspaces and the servers.
 */
export function readFirstScreen(early: Pick<EarlyCalls, 'start'>, settings: AppSettings, workspacePath: string | undefined): void {
  early.start('system.cmVersion', []);
  if (workspacePath) {
    early.start('workspaces.info', [workspacePath]);
    early.start('pendingChanges.list', [workspacePath, settings.pendingChanges]);
  } else {
    early.start('workspaces.list', []);
    early.start('repositories.servers', []);
  }
}
