import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { DraftNote } from './mergeRequestDraft';
import styles from './DraftNoteLine.module.css';

/**
 * The new merge request's line under its branches (`DraftNote`, from `mergeRequestForm`): a request still to merge
 * stands out; every other note is muted. A request it names opens with **Open it**.
 */
export function DraftNoteLine({ note, onOpen }: { note: DraftNote; onOpen: (review: CodeReviewSummary) => void }) {
  const { request } = note;
  return (
    <p className={note.blocks ? styles.note : styles.quietNote}>
      {note.text}
      {request && (
        <>
          {' '}
          <span className={styles.request}>{request.label}</span>
          <button type="button" className={styles.openIt} onClick={() => onOpen(request.review)}>
            Open it
          </button>
        </>
      )}
    </p>
  );
}
