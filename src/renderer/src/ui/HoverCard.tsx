import type { CSSProperties, ReactNode } from 'react';
import { classNames } from '../lib/classNames';
import styles from './HoverCard.module.css';

interface HoverCardProps {
  /** What it is about, first: a changeset's comment, an object's name. */
  title: ReactNode;
  /** More of it, quieter, a few lines at most. */
  body?: ReactNode;
  /** Who and when, last and smallest: "Changeset 4 · Ana Diaz · 2 hours ago". */
  meta?: ReactNode;
  /** Where its owner places it. */
  className?: string;
  style?: CSSProperties;
}

/**
 * The card an object shows on hover, wherever it is: the Branch Explorer's changesets and labels (`GraphTooltip`) and
 * a comment's chips (`ChipHoverCard`). One look for one thing.
 */
export function HoverCard({ title, body, meta, className, style }: HoverCardProps) {
  return (
    <div className={classNames(styles.card, className)} style={style}>
      <div className={styles.title}>{title}</div>
      {body && <div className={styles.body}>{body}</div>}
      {meta && <div className={styles.meta}>{meta}</div>}
    </div>
  );
}
