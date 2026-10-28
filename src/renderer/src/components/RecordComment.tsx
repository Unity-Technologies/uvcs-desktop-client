import { firstLine } from '../lib/text';
import { Highlight } from '../ui/Highlight';
import styles from './RecordRow.module.css';

/** A `RecordRow`'s comment: its first line, marked where the filter matched it; "No comment" without one. */
export function RecordComment({ comment }: { comment: string }) {
  const shown = firstLine(comment);
  if (!shown) return <span className={styles.noComment}>No comment</span>;
  return (
    <span className={styles.clipped}>
      <Highlight text={shown} />
    </span>
  );
}
