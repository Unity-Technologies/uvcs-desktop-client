import { Lock } from 'lucide-react';
import { ItemMark } from '../../../components/ItemMark';
import { describeLock, type PendingLock } from './pendingLocks';

/** A lock on a pending change, by its status letter: quiet when it's mine, in the alert tone when it's someone else's. */
export function LockMark({ lock }: { lock: PendingLock }) {
  const { label, detail } = describeLock(lock);
  return <ItemMark icon={Lock} label={label} detail={detail} tone={lock.mine ? 'quiet' : 'alert'} />;
}
