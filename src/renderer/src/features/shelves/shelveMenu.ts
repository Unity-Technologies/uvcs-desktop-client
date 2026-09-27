import { ArchiveRestore, Copy, FileDiff, MessageSquareCode, Trash2 } from 'lucide-react';
import type { Shelve } from '@shared/domain/shelve';
import type { MenuEntry } from '../../lib/actions';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { groupedMenu } from '../../lib/menuGroups';
import { openCreateCodeReviewDialog } from '../codeReviews/CreateCodeReviewDialog';
import { applyShelve, deleteShelve, showShelveChanges } from './shelveOperations';

/**
 * `left`: changes a switch or an update left, which are restored (applied, then deleted) rather than applied.
 * `mine: false`: someone else's, which Changes applies without deleting and never deletes.
 */
export function shelveMenu(workspacePath: string, shelves: Shelve[], { left = false, mine = true } = {}): MenuEntry[] {
  if (shelves.length !== 1) return [];
  const shelve = shelves[0]!;

  return groupedMenu({
    primary: [{ id: 'diff', label: 'Open diff', icon: FileDiff, run: () => showShelveChanges(shelve) }],
    act: [
      left
        ? { id: 'apply', label: 'Restore', icon: ArchiveRestore, run: () => void applyShelve(workspacePath, shelve.id, true) }
        : { id: 'apply', label: 'Apply to workspace', icon: ArchiveRestore, run: () => void applyShelve(workspacePath, shelve.id, false) },
      !left && mine && { id: 'applyAndDelete', label: 'Apply and delete', icon: ArchiveRestore, run: () => void applyShelve(workspacePath, shelve.id, true) },
    ],
    create: [
      {
        id: 'codeReview',
        label: 'New code review…',
        icon: MessageSquareCode,
        run: () => openCreateCodeReviewDialog(workspacePath, { kind: 'shelve', value: String(shelve.id), title: shelve.comment.split('\n')[0] }),
      },
    ],
    copy: [{ id: 'copy', label: 'Copy shelve spec', icon: Copy, run: () => copyToClipboard(`sh:${shelve.id}`, 'Shelve spec') }],
    danger: [mine && { id: 'delete', label: 'Delete…', icon: Trash2, danger: true, run: () => void deleteShelve(workspacePath, shelve.id) }],
  });
}
