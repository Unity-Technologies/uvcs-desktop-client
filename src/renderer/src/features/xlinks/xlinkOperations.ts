import { workspacePlace } from '@shared/domain/place';
import type { TreeItem, XlinkTarget } from '@shared/domain/explorer';
import { api } from '../../api/client';
import { runRead, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByPendingChangeEdit } from '../../app/refresh/refreshScopes';
import { listedItems } from '../files/directoryListing';
import { useFilesViewStore } from '../files/filesViewStore';
import { openXlinkDialog } from './XlinkDialog';
import { newXlinkOf, xlinkEditOf, type XlinkDialogTarget } from './xlinkDraft';

/** Asks what to link and creates a new xlink inside `directory` (`''` is the root), selecting it in the tree. */
export function createXlink(workspacePath: string, directory: string): void {
  const siblings = listedItems(workspacePath, directory)?.map((item) => item.name) ?? [];
  openXlinkDialog({ kind: 'create', directory, siblings }, async (draft) => {
    const xlink = newXlinkOf(directory, draft);
    const created = await runVoidAction(workspacePlace(workspacePath), "Couldn't create the xlink", () => api.xlinks.create(workspacePath, xlink), isAffectedByPendingChangeEdit);
    if (created) useFilesViewStore.getState().requestReveal(workspacePlace(workspacePath), xlink.path);
    return created;
  });
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
