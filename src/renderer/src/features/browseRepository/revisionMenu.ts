import type { TreeItem } from '@shared/domain/explorer';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runRead } from '../../app/operations/runOperation';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { toast } from '../../ui/toast/toastStore';
import { copySubmenu } from '../../components/copyMenu';
import { menuAction } from '../../components/menuWords';

/** The context menu of items in the repository tree of a changeset (not in the workspace). */
export function revisionMenu(workspacePath: string, changesetId: number, items: TreeItem[]): MenuEntry[] {
  const single = items.length === 1 ? items[0]! : null;
  const file = single && single.itemType !== 'directory' ? single : null;

  return groupedMenu([
    single && menuAction('history', () => navigation.openPage({ kind: 'history', path: single.path, changesetId })),
    file && menuAction('openRevision', () => openRevision(workspacePath, file)),
    file && menuAction('saveAs', () => void saveRevisionAs(workspacePath, file)),
    copySubmenu(
      '',
      { serverPath: items.map((item) => `/${item.path}`).join('\n'), spec: single && spec.serverPathAtChangeset(`/${single.path}`, changesetId) },
      { count: items.length },
    ),
  ]);
}

export function openRevision(workspacePath: string, item: TreeItem): void {
  void runRead(`Couldn't open ${item.name}`, () => api.explorer.openRevision(workspacePath, item.revisionId, item.name));
}

async function saveRevisionAs(workspacePath: string, item: TreeItem): Promise<void> {
  const saved = await runRead(`Couldn't save ${item.name}`, () => api.explorer.saveRevisionAs(workspacePath, item.revisionId, item.name));
  if (saved) toast.success(`Saved ${item.name}`);
}
