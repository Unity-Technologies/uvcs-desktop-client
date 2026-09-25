import { Lock } from 'lucide-react';
import { Tooltip } from '../../../ui/Tooltip';
import { lockedByOthersMessage, type PendingLock } from './pendingLocks';
import styles from './LockChip.module.css';

/** On a pending change row: "Locked" when I hold the exclusive checkout, the owner's name when someone else does. */
export function LockChip({ path, lock }: { path: string; lock: PendingLock }) {
  const tip = lock.mine
    ? 'You have this file exclusively checked out: nobody else can check it out until you check it in or undo it'
    : `${lockedByOthersMessage([{ path, lock }])} (workspace ${lock.workspace})`;
  return (
    <Tooltip content={tip}>
      <span className={styles.chip} data-mine={lock.mine}>
        <Lock size={10} />
        {lock.mine ? 'Locked' : lock.owner}
      </span>
    </Tooltip>
  );
}
