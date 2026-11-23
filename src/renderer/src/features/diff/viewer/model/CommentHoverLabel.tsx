import type { Ref } from 'react';
import { hoverLabelOf, type HoveredPart } from './commentHover';
import styles from './CommentHoverLabel.module.css';

interface CommentHoverLabelProps {
  part: HoveredPart;
  /** Shift held: a click takes the whole part. */
  wholePart: boolean;
  /** Placed by `useCommentHover` as the pointer moves. */
  ref: Ref<HTMLDivElement>;
}

/** Beside the comment cursor: what a click marks there, a point on the part or all of it. It never takes the pointer. */
export function CommentHoverLabel({ part, wholePart, ref }: CommentHoverLabelProps) {
  const { name, hint } = hoverLabelOf(part, wholePart);
  return (
    <div ref={ref} className={styles.label} aria-hidden="true">
      <span className={styles.name}>{name}</span>
      <span className={styles.hint}>{hint}</span>
    </div>
  );
}

