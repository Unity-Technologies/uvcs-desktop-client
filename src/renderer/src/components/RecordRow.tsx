import type { ReactNode } from 'react';
import { Avatar } from '../ui/Avatar';
import styles from './RecordRow.module.css';

/** A `RecordRow`'s height in a `DataTable` (its `rowHeight`, `divided`), and its placeholder rows'. */
export const RECORD_ROW_HEIGHT = 50;

interface RecordRowProps {
  /** The author, as `cm` names them: the avatar, whose tooltip names them. */
  owner: string;
  /** The first line: the comment (`RecordComment`), with what goes beside it. */
  title: ReactNode;
  /** The second line's parts (`RecordMetaPart`), a dot between each. */
  meta: ReactNode;
}

/**
 * Recorded work in two lines, as the lists beside a diff read it (a file's revisions, a branch's changesets): the
 * author's avatar, the comment, then the details. The comment gets the list's whole width; one column of avatar,
 * number, comment and date would leave it a few words.
 */
export function RecordRow({ owner, title, meta }: RecordRowProps) {
  return (
    <span className={styles.row}>
      <Avatar user={owner} size={24} />
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.meta}>{meta}</span>
      </span>
    </span>
  );
}
