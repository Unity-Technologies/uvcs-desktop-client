import type { HistoryApi } from '@shared/api/history';
import type { RevisionRef } from '@shared/domain/revision';
import {
  itemHistoryArgs,
  itemHistoryTarget,
  itemRevisionsArgs,
  parseHistoryRecords,
  parseItemHistory,
  parseWorkspaceItem,
  withServerOf,
  workspaceItemArgs,
  type WorkspaceItem,
} from '../cm/itemHistory';
import { toAbsolutePath } from '../files/workspacePaths';
import { revisionFiles } from './revisionFiles';
import type { AppsContext, ServiceContext } from './ServiceContext';

export function createHistoryService({ cm }: ServiceContext, { apps }: Pick<AppsContext, 'apps'>): HistoryApi {
  const revisions = revisionFiles(cm, (path, editorId) => apps.openInEditor(path, editorId));

  /**
   * The file as the workspace has it, read from the workspace itself: which revision, and its repository by name; none
   * when history starts from a revision (the workspace may not have its item), or when the workspace can't tell.
   */
  async function readWorkspaceItem(workspacePath: string, path: string, revision: RevisionRef | undefined): Promise<WorkspaceItem | undefined> {
    if (revision !== undefined) return undefined;
    const args = workspaceItemArgs(toAbsolutePath(workspacePath, path));
    return cm.query(args, { cwd: workspacePath }).then(parseWorkspaceItem, () => undefined);
  }

  return {
    async forItem(workspacePath, path, revision) {
      const workspaceItem = readWorkspaceItem(workspacePath, path, revision);
      const historyOutput = await cm.query(itemHistoryArgs(itemHistoryTarget(workspacePath, path, revision)), { cwd: workspacePath });
      const records = withServerOf(parseHistoryRecords(historyOutput), revision?.repository ?? (await workspaceItem)?.repository);
      const revisionsArgs = itemRevisionsArgs(records);
      const revisionsOutput = revisionsArgs ? await cm.query(revisionsArgs, { cwd: workspacePath }) : '';
      return parseItemHistory(records, revisionsOutput, (await workspaceItem)?.revisionId);
    },

    async revertTo(workspacePath, path, changesetId) {
      await cm.query(['revert', `${toAbsolutePath(workspacePath, path)}#cs:${changesetId}`], { cwd: workspacePath });
    },

    saveRevisionAs: revisions.saveAs,
    openRevision: revisions.open,
  };
}
