import type { HistoryApi } from '@shared/api/history';
import type { Place } from '@shared/domain/place';
import { cmPlace, workspaceOf } from '../cm/cmPlace';
import {
  itemHistoryArgs,
  itemHistoryTarget,
  type HistoryItem,
  itemRevisionsArgs,
  loadedRevisionOf,
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

export function createHistoryService({ cm, workspaceCopies }: ServiceContext, { apps }: Pick<AppsContext, 'apps'>): HistoryApi {
  const revisions = revisionFiles(cm, workspaceCopies, (path, editorId) => apps.openInEditor(path, editorId));

  /**
   * The file as the workspace has it, read from the workspace itself: which revision, and its repository by name; none
   * when the workspace can't tell. History started from a revision reads none: the workspace may not have its item.
   * Remembered, so its diff reads it from the disk while the file there is still that revision (`WorkspaceCopies`).
   */
  async function readWorkspaceItem({ workspacePath, path }: { workspacePath: string; path: string }): Promise<WorkspaceItem | undefined> {
    const args = workspaceItemArgs(toAbsolutePath(workspacePath, path));
    const listedAt = workspaceCopies.generationOf(workspacePath);
    const item = await cm.query(args, { cwd: workspacePath }).then(parseWorkspaceItem, () => undefined);
    const loaded = loadedRevisionOf(item, path);
    if (loaded) workspaceCopies.rememberHeld(workspacePath, [loaded], listedAt);
    return item;
  }

  return {
    /**
     * Started from a revision, the item is read by it, which names its repository: the same with or without a
     * workspace. Started from a path, it is a workspace's file.
     */
    async forItem(place: Place, path, revision) {
      const { options } = cmPlace(place);
      const item: HistoryItem = revision ? { revision } : { workspacePath: workspaceOf(place, 'The history of a workspace file'), path };
      const workspaceItem = 'workspacePath' in item ? readWorkspaceItem(item) : Promise.resolve(undefined);
      const historyOutput = await cm.query(itemHistoryArgs(itemHistoryTarget(item)), options);
      const records = withServerOf(parseHistoryRecords(historyOutput), revision?.repository ?? (await workspaceItem)?.repository);
      const revisionsArgs = itemRevisionsArgs(records);
      const revisionsOutput = revisionsArgs ? await cm.query(revisionsArgs, options) : '';
      return parseItemHistory(records, revisionsOutput, (await workspaceItem)?.revisionId);
    },

    async revertTo(workspacePath, path, changesetId) {
      await cm.query(['revert', `${toAbsolutePath(workspacePath, path)}#cs:${changesetId}`], { cwd: workspacePath });
    },

    saveRevisionAs: revisions.saveAs,
    openRevision: revisions.open,
  };
}
