import { Lock } from 'lucide-react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { lockedByOthersMessage, type PendingLocks } from './pendingLocks';
import styles from './LockedByOthersNotice.module.css';

/** Above the check-in: which of the checked changes someone else has locked, so the check-in would fail. */
export function LockedByOthersNotice({ changes, locks }: { changes: PendingChange[]; locks: PendingLocks }) {
  const locked = changes.flatMap((change) => {
    const lock = locks.get(change.path);
    return lock && !lock.mine ? [{ path: change.path, lock }] : [];
  });
  if (locked.length === 0) return null;
  const message = lockedByOthersMessage(locked);
  return (
    <div className={styles.notice} data-tip={locked.length > 1 ? locked.map(({ path, lock }) => `${path} — ${lock.owner}`).join('\n') : undefined}>
      <Lock size={13} className={styles.icon} />
      <span className={styles.text}>{message}</span>
    </div>
  );
}
