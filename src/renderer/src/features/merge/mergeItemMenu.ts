import { copySubmenu } from '../../components/copyMenu';
import { navigation } from '../../app/navigation/navigationStore';
import { menuAction } from '../../components/menuWords';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import type { MergeLabels } from './mergeDescription';
import type { MergeItem } from './mergeItems';
import type { FileConflictDecision } from './resolve/fileConflictDecision';
import { keepVersionEntries } from './resolve/keepVersionEntries';

/**
 * The menu of what the merge page lists, as any list of changed files has it: a conflicting file's "Keep yours" and
 * "Keep incoming" (`keepVersionEntries`), its history, and Copy.
 */
export function mergeItemMenu(items: MergeItem[], labels: MergeLabels, decide: (key: string, decision: FileConflictDecision) => void): MenuEntry[] {
  const single = items.length === 1 ? items[0]! : null;
  const conflictKeys = single?.kind === 'fileConflict' ? [single.state.file.key] : [];
  return groupedMenu([
    ...keepVersionEntries(conflictKeys, labels, decide),
    single && menuAction('history', () => navigation.openPage({ kind: 'history', path: single.path })),
    copySubmenu('', { path: items.map((item) => item.path).join('\n') }, { count: items.length }),
  ]);
}
