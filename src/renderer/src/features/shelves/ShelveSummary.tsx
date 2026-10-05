import type { Shelve } from '@shared/domain/shelve';
import { displayName } from '../../lib/userName';
import { SummaryComment } from '../changesets/SummaryComment';
import { Avatar } from '../../ui/Avatar';
import { RelativeTime } from '../../ui/RelativeTime';
import styles from '../changesets/ChangesetSummary.module.css';

/** Who, when and why of a shelve, over its diff, read like a changeset's (`ChangesetSummary`). */
export function ShelveSummary({ shelve }: { shelve: Shelve }) {
  return (
    <div className={styles.summary}>
      <SummaryComment comment={shelve.comment} />
      <div className={styles.meta}>
        <Avatar user={shelve.owner} size={18} />
        <span className={styles.author}>{displayName(shelve.owner)}</span>
        <span className={styles.dot}>·</span>
        <RelativeTime date={shelve.date} />
        <span className={styles.dot}>·</span>
        <span className={styles.changeset}>sh:{shelve.id}</span>
        <span className={styles.dot}>·</span>
        <span>on cs:{shelve.parentChangeset}</span>
      </div>
    </div>
  );
}
