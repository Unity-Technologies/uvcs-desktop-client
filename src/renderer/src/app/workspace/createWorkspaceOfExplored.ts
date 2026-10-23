import { splitRepositorySpec } from '../../lib/servers';
import { openCreateWorkspaceDialog } from '../home/dialogs/CreateWorkspaceDialog';
import { rememberRecentWorkspace } from '../settings/useSettings';
import { useSession } from './sessionStore';

/**
 * Makes the repository explored a workspace, without leaving it: the New workspace dialog with the repository fixed;
 * created, this window opens it on the view and pages it shows (every view of a repository is a workspace's too),
 * while its files download (`createWorkspaceAndUpdate`), and remembers it as recent.
 */
export function createWorkspaceOfExplored(repository: string): void {
  openCreateWorkspaceDialog({
    repository: { name: splitRepositorySpec(repository).name, spec: repository },
    onCreated: (workspacePath) => {
      useSession.getState().openWorkspace(workspacePath);
      void rememberRecentWorkspace(workspacePath);
    },
  });
}
