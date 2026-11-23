import type { Ref } from 'react';
import { hoverLabelOf, type HoveredPart } from './commentHover';
import styles from './CommentHoverLabel.module.css';

interface CommentHoverLabelProps {
  part: HoveredPart;
  /** Placed by `useCommentHover` as the pointer moves. */
  ref: Ref<HTMLDivElement>;
}

/** Beside the comment cursor: the name of the part under it, and how to comment on all of it. It never takes the pointer. */
export function CommentHoverLabel({ part, ref }: CommentHoverLabelProps) {
  const { name, hint } = hoverLabelOf(part);
  return (
    <div ref={ref} className={styles.label} aria-hidden="true">
      <span className={styles.name}>{name}</span>
      <span className={styles.hint}>{hint}</span>
    </div>
  );
}
