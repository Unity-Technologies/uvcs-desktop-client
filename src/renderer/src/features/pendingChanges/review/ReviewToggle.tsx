import { CircleCheck } from 'lucide-react';
import { Tooltip } from '../../../ui/Tooltip';
import type { ReviewStatus } from './reviewProgress';
import styles from './ReviewToggle.module.css';

const LABELS: Record<ReviewStatus, string> = {
  unreviewed: 'Mark as reviewed',
  reviewed: 'Reviewed · click to clear the mark',
  changedSinceReview: 'Changed since your review · mark as reviewed again',
};

interface ReviewToggleProps {
  status: ReviewStatus;
  onToggle: () => void;
  /** Lets the row reveal the toggle on hover while the file is unreviewed. */
  className?: string;
}

/** The check at the end of a pending change row: whether the file was reviewed, and a click to change it. */
export function ReviewToggle({ status, onToggle, className }: ReviewToggleProps) {
  return (
    <Tooltip content={LABELS[status]} shortcut="r">
      <button
        type="button"
        className={`${styles.toggle} ${className ?? ''}`}
        data-status={status}
        aria-label={LABELS[status]}
        aria-pressed={status === 'reviewed'}
        onMouseDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        <CircleCheck size={14} />
      </button>
    </Tooltip>
  );
}
