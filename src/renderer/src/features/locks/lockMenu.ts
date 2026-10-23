import type { Place } from '@shared/domain/place';
import type { Lock } from '@shared/domain/lock';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { copySubmenu } from '../../components/copyMenu';
import { menuAction } from '../../components/menuWords';
import { isReleasable, releaseLocks, removeLocks, unlocksIn } from './lockOperations';

/** A lock's menu: copying, and releasing or removing it where the place unlocks (`unlocksIn`). */
export function lockMenu(place: Place, locks: Lock[]): MenuEntry[] {
  const unlocks = unlocksIn(place);
  const releasable = locks.filter(isReleasable);
  const single = locks.length === 1 ? locks[0]! : null;
  return groupedMenu([
    unlocks && releasable.length > 0 && menuAction('release', () => void releaseLocks(place, releasable)),
    copySubmenu('', { path: locks.map((lock) => lock.path).join('\n'), guid: single?.guid }, { count: locks.length }),
    unlocks && menuAction('remove', () => void removeLocks(place, locks), { label: locks.length === 1 ? 'Remove lock…' : `Remove ${locks.length} locks…` }),
  ]);
}
