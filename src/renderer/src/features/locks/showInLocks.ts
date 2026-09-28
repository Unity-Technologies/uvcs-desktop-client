import { navigation } from '../../app/navigation/navigationStore';
import { selectInView } from '../../app/navigation/viewSelectionStore';
import type { PendingLock } from '../pendingChanges/locks/pendingLocks';

/**
 * The Locks view, opened on a locked file's lock among everyone's (the view opens with its filter empty and every
 * owner shown, so the row is there), from the file's lock mark or its menu.
 */
export function showInLocks(workspacePath: string, lock: PendingLock): void {
  selectInView(workspacePath, 'locks', lock.key);
  navigation.goToView('locks');
}
