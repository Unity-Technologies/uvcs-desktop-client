import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { classNames } from '../../../lib/classNames';
import { rowTakesClick } from '../../../lib/clickedOutsideControls';
import styles from './ReviewConversation.module.css';

/**
 * A timeline line that folds what's under it: a click anywhere on it folds and unfolds, its time and its words too,
 * while a link or a button inside (a changeset) keeps its own click; its chevron always ends it, after the time, and is
 * the way to fold by keyboard, named by `label`, the line's words.
 */
export function FoldableLine({ open, onToggle, label, className, tip, children }: {
  open: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
  /** The line's whole words, shown when they're cut off. */
  tip?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={classNames(styles.foldableLine, className)}
      data-tip={tip}
      data-tip-overflow={tip === undefined ? undefined : ''}
      onClick={(event) => rowTakesClick(event) && onToggle()}
    >
      {children}
      <button type="button" className={styles.foldChevron} aria-expanded={open} aria-label={label} onClick={onToggle}>
        <ChevronRight size={14} aria-hidden />
      </button>
    </div>
  );
}
