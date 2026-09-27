import type { ReactNode } from 'react';
import styles from './ItemRow.module.css';

/** Whether an item is under version control: private and ignored items step back instead of wearing a mark. */
export type ItemPresence = 'controlled' | 'private' | 'ignored';

interface ItemRowProps {
  /** What the item is: an `ItemIcon`. */
  icon: ReactNode;
  /** Its name or path (a `PathLabel`, a highlighted name...), cut with an ellipsis before anything after it. */
  label: ReactNode;
  /** Just left of the status, in `ItemPathRow`'s order: tags, conflict states, the review mark, then `ItemMark`s (xlink, lock). */
  extras?: ReactNode;
  /** At the end of the row, one column down the list whatever the depth: an `ItemStatusMark`. */
  status?: ReactNode;
  presence?: ItemPresence;
  /** Struck through: an item deleted by a pending change. */
  deleted?: boolean;
  /** Stepped back, a reviewed file: its icon, name and status fade while its extras (the review mark) stay clickable. */
  faded?: boolean;
}

/**
 * A file or folder in a list: its icon and name, then at the end of the row whatever it carries and its status, the
 * way every list of items reads (Files, Changes, a changeset's files). Private items dim, ignored ones further.
 */
export function ItemRow({ icon, label, extras, status, presence = 'controlled', deleted = false, faded = false }: ItemRowProps) {
  return (
    <span className={styles.row} data-presence={presence} data-faded={faded || undefined}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label} data-deleted={deleted || undefined}>
        {label}
      </span>
      {(extras || status) && (
        <span className={styles.trailing}>
          {extras}
          {status && <span className={styles.status}>{status}</span>}
        </span>
      )}
    </span>
  );
}
