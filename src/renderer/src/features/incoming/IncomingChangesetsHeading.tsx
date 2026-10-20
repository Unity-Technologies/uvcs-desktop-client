import { SkeletonBar } from '../../ui/Skeleton';
import styles from './IncomingChangesetList.module.css';

/**
 * The changesets' heading where there is no list to fold: while Incoming checks (`count` undefined, a placeholder),
 * and once it's up to date ("0", as Changes says "0 files" when nothing is pending).
 */
export function IncomingChangesetsHeading({ count }: { count: number | undefined }) {
  return (
    <section className={styles.section}>
      <div className={styles.header} data-static>
        {/* Where the list's chevron goes, so the title lines up with the list's heading. */}
        <span className={styles.chevronPlace} aria-hidden />
        <span className={styles.title}>Changesets</span>
        <span className={styles.count}>{count ?? <SkeletonBar width="16px" />}</span>
      </div>
    </section>
  );
}
