import { Lock } from 'lucide-react';
import { useWorkspacePath } from '../../../app/workspace/useWorkspace';
import { ItemMark } from '../../../components/ItemMark';
import { showInLocks } from '../../locks/showInLocks';
import { describeLock, type PendingLock } from './pendingLocks';

/**
 * A lock on a pending change, by its status letter: quiet when it's mine, in the alert tone when it's someone else's.
 * Clicking it opens the Locks view on that lock.
 */
export function LockMark({ lock }: { lock: PendingLock }) {
  const workspacePath = useWorkspacePath();
  const { label, detail } = describeLock(lock);
  return (
    <ItemMark
      icon={Lock}
      label={`${label} · click to see all locks`}
      detail={detail}
      tone={lock.mine ? 'quiet' : 'alert'}
      onClick={() => showInLocks(workspacePath, lock)}
    />
  );
}
