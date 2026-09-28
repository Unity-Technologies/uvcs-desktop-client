import type { TreeItem } from '@shared/domain/explorer';
import { otherRepository } from '@shared/domain/repository';
import { revisionRef } from '@shared/domain/revision';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runRead } from '../../app/operations/runOperation';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { toast } from '../../ui/toast/toastStore';
import { copySubmenu } from '../../components/copyMenu';
import { menuAction } from '../../components/menuWords';

/**
 * The context menu of items in the repository tree of a changeset (not in the workspace). `repository` is the one
 * browsed: an item under an xlink is in another, which no path at `changesetId` reaches, so its spec names its revision.
 */
export function revisionMenu(workspacePath: string, changesetId: number, repository: string | undefined, items: TreeItem[]): MenuEntry[] {
  const single = items.length === 1 ? items[0]! : null;
  const file = single && single.itemType !== 'directory' ? single : null;
  const singleSpec =
    single && (otherRepository(single.repository, repository) ? spec.revision(single) : spec.serverPathAtChangeset(`/${single.path}`, changesetId));

  return groupedMenu([
    single && menuAction('history', () => navigation.openPage({ kind: 'history', path: single.path, revision: revisionRef(single) })),
    file && menuAction('openRevision', () => openRevision(workspacePath, file)),
    file && menuAction('saveAs', () => void saveRevisionAs(workspacePath, file)),
    copySubmenu('', { serverPath: items.map((item) => `/${item.path}`).join('\n'), spec: singleSpec }, { count: items.length }),
  ]);
}

export function openRevision(workspacePath: string, item: TreeItem): void {
  void runRead(`Couldn't open ${item.name}`, () => api.explorer.openRevision(workspacePath, revisionRef(item), item.name));
}

async function saveRevisionAs(workspacePath: string, item: TreeItem): Promise<void> {
  const saved = await runRead(`Couldn't save ${item.name}`, () => api.explorer.saveRevisionAs(workspacePath, revisionRef(item), item.name));
  if (saved) toast.success(`Saved ${item.name}`);
}
