import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { revisionIn } from '@shared/domain/revision';
import { navigation } from '../../app/navigation/navigationStore';
import type { MenuEntry } from '../../lib/actions';
import { copySubmenu } from '../../components/copyMenu';
import { openRevisionWithSubmenu } from '../../components/externalApps/openWithMenu';
import { menuAction } from '../../components/menuWords';
import { groupedMenu } from '../../lib/menuGroups';
import { fileNameOf } from '../../lib/text';
import { openRevision, saveRevisionAs } from '../history/revisionOperations';
import { reviewMenuEntry } from '../review/reviewMenuEntry';
import type { ListReview } from '../review/useReviewMode';
import { diffEntryAnnotation, diffEntryHistory } from './diffEntryHistory';

/** Context menu for a file in a diff: mark it reviewed, open or save the newer revision, or jump to its history, annotated or not. */
export function diffEntryMenu(workspacePath: string, target: DiffTarget, entries: DiffEntry[], review: ListReview<DiffEntry>): MenuEntry[] {
  const single = entries.length === 1 ? entries[0]! : null;
  const revision = single && (revisionIn(single.repository, single.revisionId) ?? revisionIn(single.repository, single.baseRevisionId));
  const isFile = single !== null && single.itemType !== 'directory' && revision !== null;
  const annotated = single && diffEntryAnnotation(target, single);

  return groupedMenu([
    reviewMenuEntry(entries, review),
    single && menuAction('history', () => navigation.openPage(diffEntryHistory(target, single))),
    annotated && menuAction('annotate', () => navigation.openPage(annotated)),
    isFile && menuAction('openRevision', () => void openRevision(workspacePath, revision, fileNameOf(single.path))),
    isFile && openRevisionWithSubmenu((editorId) => openRevision(workspacePath, revision, fileNameOf(single.path), editorId)),
    isFile && menuAction('saveAs', () => void saveRevisionAs(workspacePath, revision, fileNameOf(single.path))),
    copySubmenu('', { path: entries.map((entry) => entry.path).join('\n') }, { count: entries.length }),
  ]);
}
