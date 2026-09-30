import type { CmClient } from '../cm/CmClient';
import { changesWorkspace, rewritesChangelists } from '../watch/changesWorkspace';
import type { WorkspaceWatchers } from '../watch/WorkspaceWatchers';
import type { WorkspaceHeaders } from '../workspace/WorkspaceHeaders';

/**
 * The renderer refreshes its views after its own writes, so the watcher of the workspace a command runs in drops the
 * events it causes; and what was read of that workspace (`WorkspaceHeaders`) is read again once it starts and ends.
 */
export function ignoreOwnCommandWrites(
  cm: Pick<CmClient, 'onCommandStarted'>,
  watchers: Pick<WorkspaceWatchers, 'ignoreOwnWrite'>,
  headers: Pick<WorkspaceHeaders, 'forget'>,
): void {
  cm.onCommandStarted(({ args, cwd, finished }) => {
    if (rewritesChangelists(args)) watchers.ignoreOwnWrite(finished, cwd, 'changelists');
    if (!changesWorkspace(args)) return;
    watchers.ignoreOwnWrite(finished, cwd);
    headers.forget(cwd);
    const forget = (): void => headers.forget(cwd);
    void finished.then(forget, forget);
  });
}
