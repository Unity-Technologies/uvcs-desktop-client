import { DetailsSkeleton } from './DetailsSection';
import changesStyles from './DetailsChangesPane.module.css';
import styles from './DetailsPanel.module.css';
import sectionStyles from './DetailsSection.module.css';

/** The whole panel while the list it describes loads: the hero's shape, then the changes pane. */
export function DetailsPanelSkeleton() {
  return (
    <aside className={styles.panel} aria-busy="true" aria-label="Loading">
      <div className={styles.top}>
        <header className={styles.hero}>
          <DetailsSkeleton rows={4} />
        </header>
      </div>
      <section className={changesStyles.changes} data-expanded={false}>
        <div className={changesStyles.header}>
          <span className={sectionStyles.skeletonRow} style={{ width: 64 }} />
        </div>
      </section>
    </aside>
  );
}
