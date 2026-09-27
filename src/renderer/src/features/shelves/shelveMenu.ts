import { ArchiveRestore, Copy, FileDiff, MessageSquareCode, Trash2 } from 'lucide-react';
import type { Shelve } from '@shared/domain/shelve';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../lib/actions';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { openCreateCodeReviewDialog } from '../codeReviews/CreateCodeReviewDialog';
import { applyShelve, deleteShelve, showShelveChanges } from './shelveOperations';

/** `left`: changes a switch or an update left, which are restored (applied, then deleted) rather than applied. */
export function shelveMenu(workspacePath: string, shelves: Shelve[], { left = false } = {}): MenuEntry[] {
  if (shelves.length !== 1) return [];
  const shelve = shelves[0]!;

  return tidyMenu([
    left
      ? { id: 'apply', label: 'Restore', icon: ArchiveRestore, run: () => void applyShelve(workspacePath, shelve.id, true) }
      : { id: 'apply', label: 'Apply to workspace', icon: ArchiveRestore, run: () => void applyShelve(workspacePath, shelve.id, false) },
    !left && { id: 'applyAndDelete', label: 'Apply and delete', icon: ArchiveRestore, run: () => void applyShelve(workspacePath, shelve.id, true) },
    { id: 'diff', label: 'Show shelved changes', icon: FileDiff, run: () => showShelveChanges(shelve) },
    {
      id: 'codeReview',
      label: 'Create code review…',
      icon: MessageSquareCode,
      run: () => openCreateCodeReviewDialog(workspacePath, { kind: 'shelve', value: String(shelve.id), title: shelve.comment.split('\n')[0] }),
    },
    SEPARATOR,
    { id: 'copy', label: 'Copy shelve spec', icon: Copy, run: () => copyToClipboard(`sh:${shelve.id}`, 'Shelve spec') },
    SEPARATOR,
    { id: 'delete', label: 'Delete…', icon: Trash2, danger: true, run: () => void deleteShelve(workspacePath, shelve.id) },
  ]);
}
