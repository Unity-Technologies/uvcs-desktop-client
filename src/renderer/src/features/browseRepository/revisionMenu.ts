import { AppWindow, Copy, Download, History } from 'lucide-react';
import type { TreeItem } from '@shared/domain/explorer';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runRead } from '../../app/operations/runOperation';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { toast } from '../../ui/toast/toastStore';
import { copyPaths } from '../pendingChanges/pendingChangeOperations';

/** The context menu of items in the repository tree of a changeset (not in the workspace). */
export function revisionMenu(workspacePath: string, changesetId: number, items: TreeItem[]): MenuEntry[] {
  const single = items.length === 1 ? items[0]! : null;
  const file = single && single.itemType !== 'directory' ? single : null;

  return groupedMenu({
    primary: [file && { id: 'open', label: 'Open this revision', icon: AppWindow, run: () => openRevision(workspacePath, file) }],
    navigate: [single && { id: 'history', label: 'View history', icon: History, run: () => navigation.openPage({ kind: 'history', path: single.path, changesetId }) }],
    external: [file && { id: 'saveAs', label: 'Save this revision as…', icon: Download, run: () => void saveRevisionAs(workspacePath, file) }],
    copy: [{ id: 'copy', label: 'Copy repository path', icon: Copy, run: () => copyPaths(items.map((item) => `/${item.path}`)) }],
  });
}

export function openRevision(workspacePath: string, item: TreeItem): void {
  void runRead(`Couldn't open ${item.name}`, () => api.explorer.openRevision(workspacePath, item.revisionId, item.name));
}

async function saveRevisionAs(workspacePath: string, item: TreeItem): Promise<void> {
  const saved = await runRead(`Couldn't save ${item.name}`, () => api.explorer.saveRevisionAs(workspacePath, item.revisionId, item.name));
  if (saved) toast.success(`Saved ${item.name}`);
}
