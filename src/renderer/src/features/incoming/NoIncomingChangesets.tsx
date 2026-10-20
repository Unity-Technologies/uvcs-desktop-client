import styles from './IncomingChangesetList.module.css';

/** Incoming's list once up to date: the changesets' heading counting none, as Changes says "0 files" when nothing is pending. */
export function NoIncomingChangesets() {
  return (
    <section className={styles.section}>
      <div className={styles.header} data-static>
        <span className={styles.title}>Changesets</span>
        <span className={styles.count}>0</span>
      </div>
    </section>
  );
}
