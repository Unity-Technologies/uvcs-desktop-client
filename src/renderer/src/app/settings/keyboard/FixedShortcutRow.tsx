import { Highlight } from '../../../ui/Highlight';
import type { FixedRow } from './keyboardRows';
import { KeyCaps } from './KeyCaps';
import styles from './KeyboardPane.module.css';

/** A shortcut that can't change: its keys, quieter than a changeable one's, and why it stays in their tooltip. */
export function FixedShortcutRow({ row }: { row: FixedRow }) {
  return (
    <div className={styles.row}>
      <span className={styles.label} data-fixed>
        <Highlight text={row.label} />
      </span>
      <span className={styles.fixedKeys} data-tip={row.why} aria-label={`${row.label}: ${row.why}`}>
        <KeyCaps keys={row.keys} />
      </span>
      <span className={styles.resetSlot} />
    </div>
  );
}
