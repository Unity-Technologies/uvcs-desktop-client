import { AppWindow, Copy, Download, History } from 'lucide-react';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { navigation } from '../../app/navigation/navigationStore';
import type { MenuEntry } from '../../lib/actions';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { groupedMenu } from '../../lib/menuGroups';
import { fileNameOf } from '../../lib/text';
import { openRevision, saveRevisionAs } from '../history/revisionOperations';
import { reviewMenuEntry } from '../review/reviewMenuEntry';
import type { ListReview } from '../review/useReviewMode';
import { diffEntryHistory } from './diffEntryHistory';

/** Context menu for a file in a diff: mark it reviewed, open or save the newer revision, or jump to its history. */
export function diffEntryMenu(workspacePath: string, target: DiffTarget, entries: DiffEntry[], review: ListReview<DiffEntry>): MenuEntry[] {
  const single = entries.length === 1 ? entries[0]! : null;
  const revisionId = single ? (single.revisionId !== -1 ? single.revisionId : single.baseRevisionId) : -1;
  const isFile = single !== null && single.itemType !== 'directory';

  return groupedMenu({
    act: [reviewMenuEntry(entries, review)],
    navigate: [single && { id: 'history', label: 'View history', icon: History, run: () => navigation.openPage(diffEntryHistory(target, single)) }],
    external: [
      isFile && {
        id: 'open',
        label: 'Open this revision',
        icon: AppWindow,
        run: () => void openRevision(workspacePath, revisionId, fileNameOf(single.path)),
      },
      isFile && {
        id: 'save',
        label: 'Save this revision as…',
        icon: Download,
        run: () => void saveRevisionAs(workspacePath, revisionId, fileNameOf(single.path)),
      },
    ],
    copy: [
      entries.length > 0 && {
        id: 'copy',
        label: entries.length === 1 ? 'Copy path' : `Copy ${entries.length} paths`,
        icon: Copy,
        run: () => copyToClipboard(entries.map((entry) => entry.path).join('\n'), entries.length === 1 ? 'Path' : 'Paths'),
      },
    ],
  });
}
