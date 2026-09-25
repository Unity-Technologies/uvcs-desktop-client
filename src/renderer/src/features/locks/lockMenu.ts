import { Copy, LockOpen, Trash2 } from 'lucide-react';
import type { Lock } from '@shared/domain/lock';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../lib/actions';
import { copyPaths } from '../pendingChanges/pendingChangeOperations';
import { isReleasable, releaseLocks, removeLocks } from './lockOperations';

export function lockMenu(workspacePath: string, locks: Lock[]): MenuEntry[] {
  const releasable = locks.filter(isReleasable);
  return tidyMenu([
    releasable.length > 0 && { id: 'release', label: 'Release lock', icon: LockOpen, run: () => void releaseLocks(workspacePath, releasable) },
    { id: 'remove', label: 'Remove lock', icon: Trash2, danger: true, run: () => void removeLocks(workspacePath, locks) },
    SEPARATOR,
    { id: 'copy', label: 'Copy path', icon: Copy, run: () => copyPaths(locks.map((lock) => lock.path)) },
  ]);
}
