import styles from './WorkspaceChip.module.css';

/** A recent workspace whose folder is gone. */
export function MissingChip() {
  return (
    <span className={`${styles.chip} ${styles.missing}`} data-tip="Its folder can't be found">
      Missing
    </span>
  );
}
