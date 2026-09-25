import { GitBranch } from 'lucide-react';
import type { Changeset } from '@shared/domain/changeset';
import { Avatar } from '../../ui/Avatar';
import { RelativeTime } from '../../ui/RelativeTime';
import { displayName } from '../../lib/userName';
import { firstLine } from '../../lib/text';
import styles from './ChangesetSummary.module.css';

/** Who, when, where and why of a changeset, with its full comment. */
export function ChangesetSummary({ changeset }: { changeset: Changeset }) {
  const title = firstLine(changeset.comment);
  const body = changeset.comment.trim().split('\n').slice(1).join('\n').trim();

  return (
    <div className={styles.summary}>
      <div className={styles.title}>{title || <span className={styles.noComment}>No comment</span>}</div>
      {body && <div className={`${styles.body} selectable`}>{body}</div>}
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
