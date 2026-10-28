import { workspacePlace } from '@shared/domain/place';
import type { TreeItem, XlinkTarget } from '@shared/domain/explorer';
import { api } from '../../api/client';
import { runOperation, runRead, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByCheckinOrUpdate, isAffectedByPendingChangeEdit } from '../../app/refresh/refreshScopes';
import { listedItems } from '../files/directoryListing';
import { useFilesViewStore } from '../files/filesViewStore';
import { createdXlinkMessage, loadedXlinkMessage } from './createdXlinkMessage';
import { openXlinkDialog } from './XlinkDialog';
import { checkinCommentOf, newXlinkOf, xlinkEditOf, type XlinkDialogTarget } from './xlinkDraft';

/**
 * Asks what to link and creates a new xlink inside `directory` (`''` is the root), checked in with its files loaded
 * (`XlinksApi.create`), selecting it in the tree. The dialog stays open only when the xlink couldn't be created at all.
 */
export function createXlink(workspacePath: string, directory: string): void {
  const siblings = listedItems(workspacePath, directory)?.map((item) => item.name) ?? [];
  openXlinkDialog({ kind: 'create', directory, siblings }, async (draft) => {
    const xlink = newXlinkOf(directory, draft);
    const created = await runOperation({
      title: `Creating xlink ${xlink.path}`,
      workspacePath,
      // It checks in and updates: nothing else that changes the workspace may run meanwhile.
      kind: 'update',
      cancellable: false,
      run: (operationId) => api.xlinks.create(workspacePath, xlink, checkinCommentOf(directory, draft), operationId),
      success: (result) => createdXlinkMessage(xlink.path, result, () => void loadXlinkFiles(workspacePath, xlink.path)),
      affects: isAffectedByCheckinOrUpdate,
    });
    if (created) useFilesViewStore.getState().requestReveal(workspacePlace(workspacePath), xlink.path);
    return created !== undefined;
  });
}

/** Loads the files of the checked-in xlink at `path` (`XlinksApi.load`): for one checked in without them. Resolves to whether they loaded. */
export async function loadXlinkFiles(workspacePath: string, path: string): Promise<boolean> {
  const loaded = await runOperation({
    title: `Loading the files of xlink ${path}`,
    workspacePath,
    // It updates the xlink's folder, and may put the other changes aside meanwhile.
    kind: 'update',
    cancellable: false,
    run: (operationId) => api.xlinks.load(workspacePath, path, operationId),
    success: (result) => loadedXlinkMessage(path, result),
    affects: isAffectedByCheckinOrUpdate,
  });
  return loaded !== undefined;
}

/** Opens the xlink at `item` to point it elsewhere or change its rules, once its rules are read (a writable one's). */
export async function editXlink(workspacePath: string, item: Pick<TreeItem, 'path' | 'name'> & { xlink: XlinkTarget }, added: boolean): Promise<void> {
  const rules = item.xlink.writable ? await runRead("Couldn't read the xlink", () => api.xlinks.rules(workspacePath, item.path)) : [];
  if (!rules) return;
  const target: Extract<XlinkDialogTarget, { kind: 'edit' }> = { kind: 'edit', path: item.path, name: item.name, xlink: item.xlink, rules, added };
  openXlinkDialog(target, async (draft) => {
    const edit = xlinkEditOf(target, draft);
    return edit !== null && runVoidAction(workspacePlace(workspacePath), "Couldn't change the xlink", () => api.xlinks.edit(workspacePath, edit), isAffectedByPendingChangeEdit);
  });
}
