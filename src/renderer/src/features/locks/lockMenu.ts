import { workspacePathOf, type Place } from '@shared/domain/place';
import type { Lock } from '@shared/domain/lock';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { copySubmenu } from '../../components/copyMenu';
import { menuAction } from '../../components/menuWords';
import { isReleasable, releaseLocks, removeLocks } from './lockOperations';

/** A lock's menu: copying, and, in a workspace, releasing or removing it (not yet offered with no workspace). */
export function lockMenu(place: Place, locks: Lock[]): MenuEntry[] {
  const workspacePath = workspacePathOf(place);
  const releasable = locks.filter(isReleasable);
  const single = locks.length === 1 ? locks[0]! : null;
  return groupedMenu([
    workspacePath !== null && releasable.length > 0 && menuAction('release', () => void releaseLocks(workspacePath, releasable)),
    copySubmenu('', { path: locks.map((lock) => lock.path).join('\n'), guid: single?.guid }, { count: locks.length }),
    workspacePath !== null &&
      menuAction('remove', () => void removeLocks(workspacePath, locks), { label: locks.length === 1 ? 'Remove lock…' : `Remove ${locks.length} locks…` }),
  ]);
}
