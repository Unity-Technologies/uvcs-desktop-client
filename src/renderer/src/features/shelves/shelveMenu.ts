import { ArchiveRestore, Copy, FileDiff, Trash2 } from 'lucide-react';
import type { Shelve } from '@shared/domain/shelve';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../lib/actions';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { applyShelve, deleteShelve, showShelveChanges } from './shelveOperations';

export function shelveMenu(workspacePath: string, shelves: Shelve[]): MenuEntry[] {
  if (shelves.length !== 1) return [];
  const shelve = shelves[0]!;

  return tidyMenu([
    { id: 'apply', label: 'Apply to workspace', icon: ArchiveRestore, run: () => void applyShelve(workspacePath, shelve) },
    { id: 'changes', label: 'Show shelved changes', icon: FileDiff, run: () => showShelveChanges(shelve) },
    SEPARATOR,
    { id: 'copy', label: 'Copy shelve spec', icon: Copy, run: () => copyToClipboard(`sh:${shelve.id}`, 'Shelve spec') },
    SEPARATOR,
    { id: 'delete', label: 'Delete…', icon: Trash2, danger: true, run: () => void deleteShelve(workspacePath, shelve) },
  ]);
}
