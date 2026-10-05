import { GitBranch } from 'lucide-react';
import type { Changeset } from '@shared/domain/changeset';
import { Avatar } from '../../ui/Avatar';
import { RelativeTime } from '../../ui/RelativeTime';
import { displayName } from '../../lib/userName';
import { SummaryComment } from './SummaryComment';
import styles from './ChangesetSummary.module.css';

/** Who, when, where and why of a changeset, its comment folded when long. */
export function ChangesetSummary({ changeset }: { changeset: Changeset }) {
  return (
    <div className={styles.summary}>
      <SummaryComment comment={changeset.comment} />
      <div className={styles.meta}>
        <Avatar user={changeset.owner} size={18} />
        <span className={styles.author}>{displayName(changeset.owner)}</span>
        <span className={styles.dot}>·</span>
        <RelativeTime date={changeset.date} />
        <span className={styles.dot}>·</span>
        <span className={styles.changeset}>cs:{changeset.id}</span>
        <span className={styles.branch}>
          <GitBranch size={12} />
          {changeset.branch}
        </span>
      </div>
    </div>
  );
}
