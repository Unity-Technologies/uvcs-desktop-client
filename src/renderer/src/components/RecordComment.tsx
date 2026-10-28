import { CommentLine } from './comments/CommentLine';
import { firstLine } from '../lib/text';
import styles from './RecordRow.module.css';

/** A `RecordRow`'s comment: its first line, marked where the filter matched it; "No comment" without one. */
export function RecordComment({ comment }: { comment: string }) {
  const shown = firstLine(comment);
  if (!shown) return <span className={styles.noComment}>No comment</span>;
  return (
    <span className={styles.clipped}>
      <CommentLine comment={shown} />
    </span>
  );
}
