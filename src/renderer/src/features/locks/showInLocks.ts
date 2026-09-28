import { navigation } from '../../app/navigation/navigationStore';
import { selectInView } from '../../app/navigation/viewSelectionStore';
import type { PendingLock } from '../pendingChanges/locks/pendingLocks';
import { useLocksViewStore } from './locksViewStore';

/**
 * The Locks view, opened on a locked file's lock among everyone's (its filters cleared, so the row is there), from the
 * file's lock mark or its menu.
 */
export function showInLocks(workspacePath: string, lock: PendingLock): void {
  useLocksViewStore.getState().clear();
  selectInView(workspacePath, 'locks', lock.key);
  navigation.goToView('locks');
}
