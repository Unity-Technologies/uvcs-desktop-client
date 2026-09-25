import { CircleCheck } from 'lucide-react';
import { Tooltip } from '../../ui/Tooltip';
import type { ReviewStatus } from './reviewStatus';
import styles from './ReviewToggle.module.css';

const LABELS: Record<ReviewStatus, string> = {
  unreviewed: 'Mark as reviewed',
  reviewed: 'Reviewed · click to clear the mark',
  changedSinceReview: 'Changed since your review · mark as reviewed again',
};

const FOLDER_LABELS: Record<ReviewStatus, string> = {
  unreviewed: 'Mark folder reviewed',
  reviewed: 'Folder reviewed · click to clear the marks',
  changedSinceReview: 'Mark folder reviewed',
};

interface ReviewToggleProps {
  status: ReviewStatus;
  onToggle: () => void;
  /** A folder row marks every file in it; R only toggles the selected files. */
  folder?: boolean;
}

/** The check at the end of a pending change row: whether the file (or every file in the folder) was reviewed, and a click to change it. */
export function ReviewToggle({ status, onToggle, folder = false }: ReviewToggleProps) {
  const label = (folder ? FOLDER_LABELS : LABELS)[status];
  return (
    <Tooltip content={label} shortcut={folder ? undefined : 'r'}>
      <button
        type="button"
        className={styles.toggle}
        data-status={status}
        aria-label={label}
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
