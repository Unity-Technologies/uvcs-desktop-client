import type { Lock } from '@shared/domain/lock';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { copySubmenu } from '../../components/copyMenu';
import { menuAction } from '../../components/menuWords';
import { isReleasable, releaseLocks, removeLocks } from './lockOperations';

export function lockMenu(workspacePath: string, locks: Lock[]): MenuEntry[] {
  const releasable = locks.filter(isReleasable);
  const single = locks.length === 1 ? locks[0]! : null;
  return groupedMenu([
    releasable.length > 0 && menuAction('release', () => void releaseLocks(workspacePath, releasable)),
    copySubmenu('', { path: locks.map((lock) => lock.path).join('\n'), guid: single?.guid }, { count: locks.length }),
    menuAction('remove', () => void removeLocks(workspacePath, locks), { label: locks.length === 1 ? 'Remove lock…' : `Remove ${locks.length} locks…` }),
  ]);
}
