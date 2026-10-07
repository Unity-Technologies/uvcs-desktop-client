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
 * The menu of what the merge page lists, as any list of changed files has it: "Keep yours" and "Keep incoming" for
 * the conflicting files selected (`keepVersionEntries`), a single item's history, and Copy.
 */
export function mergeItemMenu(items: MergeItem[], labels: MergeLabels, decide: (key: string, decision: FileConflictDecision) => void): MenuEntry[] {
  const single = items.length === 1 ? items[0]! : null;
  const conflictKeys = items.flatMap((item) => (item.kind === 'fileConflict' ? [item.state.file.key] : []));
  return groupedMenu([
    ...keepVersionEntries(conflictKeys, labels, decide),
    single && menuAction('history', () => navigation.openPage({ kind: 'history', path: single.path })),
    copySubmenu('', { path: items.map((item) => item.path).join('\n') }, { count: items.length }),
  ]);
}
