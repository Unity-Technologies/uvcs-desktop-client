import styles from './WorkspaceChip.module.css';

/** A deleted repository the server still keeps; `tip` says for how long (`deletedRepositoriesTip`). */
export function DeletedChip({ tip }: { tip: string }) {
  return (
    <span className={`${styles.chip} ${styles.deleted}`} data-tip={tip}>
      Deleted
    </span>
  );
}
