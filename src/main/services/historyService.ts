import type { HistoryApi } from '@shared/api/history';
import type { RevisionRef } from '@shared/domain/revision';
import {
  itemHistoryArgs,
  itemHistoryTarget,
  itemRevisionsArgs,
  parseHistoryRecords,
  parseItemHistory,
  parseWorkspaceRevision,
  workspaceRevisionArgs,
} from '../cm/itemHistory';
import { toAbsolutePath } from '../files/workspacePaths';
import { revisionFiles } from './revisionFiles';
import type { AppsContext, ServiceContext } from './ServiceContext';

export function createHistoryService({ cm, workspaceCopies }: ServiceContext, { apps }: Pick<AppsContext, 'apps'>): HistoryApi {
  const revisions = revisionFiles(cm, workspaceCopies, (path, editorId) => apps.openInEditor(path, editorId));

  /**
   * Which revision of the file the workspace has, read from the workspace itself; none when history starts from a
   * revision (the workspace may not have its item), or when the workspace can't tell. Remembered, so its diff reads
   * it from the disk while the file there is still that revision (`WorkspaceCopies`).
   */
  async function readWorkspaceRevision(workspacePath: string, path: string, revision: RevisionRef | undefined): Promise<number | undefined> {
    if (revision !== undefined) return undefined;
    const args = workspaceRevisionArgs(toAbsolutePath(workspacePath, path));
    const loaded = await cm.query(args, { cwd: workspacePath }).then((output) => parseWorkspaceRevision(output, path), () => undefined);
    if (loaded) workspaceCopies.remember(workspacePath, [loaded]);
    return loaded?.revision.revisionId;
  }

  return {
    async forItem(workspacePath, path, revision) {
      const workspaceRevision = readWorkspaceRevision(workspacePath, path, revision);
      const historyOutput = await cm.query(itemHistoryArgs(itemHistoryTarget(workspacePath, path, revision)), { cwd: workspacePath });
      const records = parseHistoryRecords(historyOutput);
      const revisionsArgs = itemRevisionsArgs(records);
      const revisionsOutput = revisionsArgs ? await cm.query(revisionsArgs, { cwd: workspacePath }) : '';
      return parseItemHistory(records, revisionsOutput, await workspaceRevision);
    },

    async revertTo(workspacePath, path, changesetId) {
      await cm.query(['revert', `${toAbsolutePath(workspacePath, path)}#cs:${changesetId}`], { cwd: workspacePath });
    },

    saveRevisionAs: revisions.saveAs,
    openRevision: revisions.open,
  };
}
