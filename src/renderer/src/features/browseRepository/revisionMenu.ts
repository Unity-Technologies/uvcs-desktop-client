import { AppWindow, Copy, Download, History } from 'lucide-react';
import type { TreeItem } from '@shared/domain/explorer';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction } from '../../app/operations/runOperation';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../lib/actions';
import { toast } from '../../ui/toast/toastStore';
import { copyPaths } from '../pendingChanges/pendingChangeOperations';

/** The context menu of items in a repository tree (not in the workspace). */
export function revisionMenu(workspacePath: string, items: TreeItem[]): MenuEntry[] {
  const single = items.length === 1 ? items[0]! : null;
  const file = single && single.itemType !== 'directory' ? single : null;

  return tidyMenu([
    file && { id: 'open', label: 'Open this revision', icon: AppWindow, run: () => openRevision(workspacePath, file) },
    file && { id: 'saveAs', label: 'Save this revision as…', icon: Download, run: () => void saveRevisionAs(workspacePath, file) },
    SEPARATOR,
    single && { id: 'history', label: 'View history', icon: History, run: () => navigation.openPage({ kind: 'history', path: single.path }) },
    SEPARATOR,
    { id: 'copy', label: 'Copy repository path', icon: Copy, run: () => copyPaths(items.map((item) => `/${item.path}`)) },
  ]);
}

export function openRevision(workspacePath: string, item: TreeItem): void {
  void runAction(workspacePath, `Couldn't open ${item.name}`, () => api.explorer.openRevision(workspacePath, item.revisionId, item.name));
}

async function saveRevisionAs(workspacePath: string, item: TreeItem): Promise<void> {
  const saved = await runAction(workspacePath, `Couldn't save ${item.name}`, () => api.explorer.saveRevisionAs(workspacePath, item.revisionId, item.name));
  if (saved) toast.success(`Saved ${item.name}`);
}
