import type { ReactNode } from 'react';
import { firstLine } from '../lib/text';
import { Avatar } from '../ui/Avatar';
import { Highlight } from '../ui/Highlight';
import styles from './RecordRow.module.css';

/** A `RecordRow`'s height in a `DataTable` (its `rowHeight`, `divided`), and its placeholder rows'. */
export const RECORD_ROW_HEIGHT = 50;

interface RecordRowProps {
  /** The author, as `cm` names them: the avatar, whose tooltip names them. */
  owner: string;
  /** The first line: the comment (`RecordComment`), with what goes beside it. */
  title: ReactNode;
  /** The second line's parts, a dot between each; a part with `recordRowStyles.clipped` gives way first. */
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

/** A comment's first line, marked where the filter matched it; "No comment" without one. */
export function RecordComment({ comment }: { comment: string }) {
  const shown = firstLine(comment);
  if (!shown) return <span className={styles.noComment}>No comment</span>;
  return (
    <span className={styles.clipped}>
      <Highlight text={shown} />
    </span>
  );
}

export { styles as recordRowStyles };
