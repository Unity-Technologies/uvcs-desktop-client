import type { Shelve } from '@shared/domain/shelve';
import { firstLine } from '../../lib/text';
import { displayName } from '../../lib/userName';
import { Avatar } from '../../ui/Avatar';
import { RelativeTime } from '../../ui/RelativeTime';
import styles from '../changesets/ChangesetSummary.module.css';

/** Who, when and why of a shelve, over its diff, read like a changeset's (`ChangesetSummary`). */
export function ShelveSummary({ shelve }: { shelve: Shelve }) {
  const title = firstLine(shelve.comment);
  const body = shelve.comment.trim().split('\n').slice(1).join('\n').trim();

  return (
    <div className={styles.summary}>
      <div className={styles.title}>{title || <span className={styles.noComment}>No comment</span>}</div>
      {body && <div className={`${styles.body} selectable`}>{body}</div>}
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
