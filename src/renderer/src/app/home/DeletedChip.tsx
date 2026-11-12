import styles from './DeletedChip.module.css';

/** A deleted repository the server still keeps; `tip` says for how long (`deletedRepositoriesTip`). */
export function DeletedChip({ tip }: { tip: string }) {
  return (
    <span className={styles.chip} data-tip={tip}>
      Deleted
    </span>
  );
}
