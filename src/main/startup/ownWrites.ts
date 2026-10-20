import type { WorkspaceChange } from '@shared/domain/workspaceChange';
import type { CmClient } from '../cm/CmClient';
import { currentCaller } from '../ipc/caller';
import { changesWorkspace, rewritesChangelists } from '../watch/changesWorkspace';
import type { WorkspaceWatchers } from '../watch/WorkspaceWatchers';
import type { WorkspaceHeaders } from '../workspace/WorkspaceHeaders';

/** What a write may have changed, for the windows that didn't run it: anything, files and `.plastic` alike. */
const ANYTHING_WRITTEN: WorkspaceChange = { content: true, pathsChanged: true, metadata: true, folders: null };

/**
 * The renderer refreshes its views after its own writes, so the watcher of the workspace a command runs in drops the
 * events it causes; and what was read of that workspace (`WorkspaceHeaders`) is read again once it starts and ends.
 * The other windows showing the workspace (a page window, the window that opened it) hear the write once it settles,
 * as a change on disk (`writtenBy`).
 */
export function ignoreOwnCommandWrites(
  cm: Pick<CmClient, 'onCommandStarted'>,
  watchers: Pick<WorkspaceWatchers, 'ignoreOwnWrite' | 'writtenBy'>,
  headers: Pick<WorkspaceHeaders, 'forget'>,
  writerOf: () => number | undefined = () => currentCaller()?.id,
): void {
  cm.onCommandStarted(({ args, cwd, finished }) => {
    if (rewritesChangelists(args)) watchers.ignoreOwnWrite(finished, cwd, 'changelists');
    if (!changesWorkspace(args)) return;
    watchers.ignoreOwnWrite(finished, cwd);
    headers.forget(cwd);
    const writer = writerOf();
    const settled = (): void => {
      headers.forget(cwd);
      if (writer !== undefined) watchers.writtenBy(writer, cwd, ANYTHING_WRITTEN);
    };
    void finished.then(settled, settled);
  });
}
