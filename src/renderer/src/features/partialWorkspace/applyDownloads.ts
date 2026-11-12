import type { PartialRule } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { runOperation } from '../../app/operations/runOperation';
import { isAffectedByCheckinOrUpdate } from '../../app/refresh/refreshScopes';

/**
 * Makes a workspace download and remove what the user chose, with one `cm partial configure`; a standard workspace
 * becomes partial with it. It counts as an
 * update: it changes the files on disk, so it blocks other updates and switches of the workspace while it runs, and
 * refreshes what one refreshes. Resolves to whether it applied.
 */
export async function applyDownloads(workspacePath: string, rules: PartialRule[]): Promise<boolean> {
  const applied = await runOperation({
    title: 'Changing what is downloaded',
    workspacePath,
    kind: 'update',
    affects: isAffectedByCheckinOrUpdate,
    run: async (operationId) => {
      await api.workspaces.configurePartial(workspacePath, rules, operationId);
      return true;
    },
    success: () => ({ title: 'Workspace has what you chose' }),
  });
  return applied === true;
}
