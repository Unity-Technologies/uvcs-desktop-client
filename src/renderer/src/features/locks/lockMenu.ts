import { Copy, LockOpen, Trash2 } from 'lucide-react';
import type { Lock } from '@shared/domain/lock';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { copyPaths } from '../pendingChanges/pendingChangeOperations';
import { isReleasable, releaseLocks, removeLocks } from './lockOperations';

export function lockMenu(workspacePath: string, locks: Lock[]): MenuEntry[] {
  const releasable = locks.filter(isReleasable);
  return groupedMenu({
    primary: [releasable.length > 0 && { id: 'release', label: 'Release lock', icon: LockOpen, run: () => void releaseLocks(workspacePath, releasable) }],
    copy: [{ id: 'copy', label: 'Copy path', icon: Copy, run: () => copyPaths(locks.map((lock) => lock.path)) }],
    danger: [{ id: 'remove', label: 'Remove lock…', icon: Trash2, danger: true, run: () => void removeLocks(workspacePath, locks) }],
  });
}
