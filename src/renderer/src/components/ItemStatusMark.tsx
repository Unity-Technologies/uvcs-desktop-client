import type { PathMove } from '../ui/followTip';
import { StatusBadge, type StatusTone } from './StatusBadge';
import styles from './ItemStatusMark.module.css';

/** What an item's status letter says: its tone, and what that means for its tooltip. */
export interface StatusMark {
  tone: StatusTone;
  label: string;
  /** A moved item whose content changed too: its C shows before its M, this the C's tooltip. */
  changedLabel?: string;
}

export interface ItemStatusMarkProps {
  /** The item's own status, for what is notable only (a pending change, a checkout): nothing marks an item up to date. */
  status?: StatusMark | null;
  /** A folder holding changes somewhere below it, marked where its own status letter would be. */
  changesInside?: boolean;
  /** Where a moved item was and is: its M's tooltip shows the move. */
  move?: PathMove;
}

/**
 * The last thing on an item's row (`ItemRow`'s `status`): its status letter, or a dot for a folder with changes inside.
 * A moved item that changed shows its C and its M side by side, as both filter chips find it (`statusTones`).
 */
export function ItemStatusMark({ status, changesInside = false, move }: ItemStatusMarkProps) {
  if (status)
    return (
      <>
        {status.changedLabel && <StatusBadge tone="changed" title={status.changedLabel} />}
        <StatusBadge tone={status.tone} title={status.label} move={status.tone === 'moved' ? move : undefined} />
      </>
    );
  return changesInside ? <span className={styles.changesInside} data-tip="Contains pending changes" /> : null;
}
