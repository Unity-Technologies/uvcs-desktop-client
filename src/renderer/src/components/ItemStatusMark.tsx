import { StatusBadge, type StatusTone } from './StatusBadge';
import styles from './ItemStatusMark.module.css';

export interface ItemStatusMarkProps {
  /** The item's own status, for what is notable only (a pending change, a checkout): nothing marks an item up to date. */
  status?: { tone: StatusTone; label: string } | null;
  /** A folder holding changes somewhere below it, marked where its own status letter would be. */
  changesInside?: boolean;
}

/** The last thing on an item's row (`ItemRow`'s `status`): its status letter, or a dot for a folder with changes inside. */
export function ItemStatusMark({ status, changesInside = false }: ItemStatusMarkProps) {
  if (status) return <StatusBadge tone={status.tone} title={status.label} />;
  return changesInside ? <span className={styles.changesInside} data-tip="Contains pending changes" /> : null;
}
