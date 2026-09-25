import { CircleDot, RotateCcw } from 'lucide-react';
import type { CodeReview } from '@shared/domain/codeReview';
import styles from './MergeTaskDialog.module.css';

/** Warns that the branch's review isn't finished: in red when it asks for rework, neutral while under review. */
export function ReviewStatusNote({ review, onOpen }: { review: CodeReview; onOpen: () => void }) {
  const rework = review.status === 'Rework required';
  return (
    <p className={styles.review} data-rework={rework}>
      {rework ? <RotateCcw size={14} /> : <CircleDot size={14} />}
      <span>
        <strong>{review.status}</strong> — code review{' '}
        <button type="button" className={styles.link} onClick={onOpen}>
          {review.title}
        </button>
        {rework ? ' asks for changes.' : ' is not finished yet.'}
      </span>
    </p>
  );
}
