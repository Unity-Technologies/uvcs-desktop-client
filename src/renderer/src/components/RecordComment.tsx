import { CommentLine } from './comments/CommentLine';
import styles from './RecordRow.module.css';

/** A `RecordRow`'s comment as one line (`CommentLine`), marked where the filter matched it; "No comment" without one. */
export function RecordComment({ comment }: { comment: string }) {
  return (
    <span className={styles.clipped}>
      <CommentLine comment={comment} placeholder={<span className={styles.noComment}>No comment</span>} />
    </span>
  );
}
