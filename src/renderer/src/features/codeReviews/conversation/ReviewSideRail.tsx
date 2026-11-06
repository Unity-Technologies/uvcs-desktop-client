import type { CodeReview } from '@shared/domain/codeReview';
import { commentLineText } from '../../../lib/comments/commentText';
import { ReviewersSection } from './ReviewersSection';
import { threadElementId } from './ReviewThreadCard';
import type { ReviewThread } from './reviewThreads';
import { ThreadKindIcon } from './ThreadKindIcon';
import styles from './ReviewConversation.module.css';

/** Beside the conversation: who reviews it and the status each gave, and the change requests and questions still open. */
export function ReviewSideRail({ review, open }: { review: CodeReview; open: readonly ReviewThread[] }) {
  return (
    <aside className={styles.rail}>
      <ReviewersSection review={review} />
      <section className={styles.railSection} aria-labelledby="review-open">
        <h2 id="review-open" className={styles.railTitle}>
          Open <span className={styles.railCount}>{open.length}</span>
        </h2>
        {open.length === 0 && <p className={styles.railEmpty}>Nothing left to answer</p>}
        <ul className={styles.openItems}>
          {open.map(({ root }) => (
            <li key={root.id}>
              <button type="button" className={styles.openItem} onClick={() => scrollToThread(root.id)}>
                <ThreadKindIcon root={root} />
                <span className={styles.openText}>{commentLineText(root.text)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

function scrollToThread(commentId: number): void {
  document.getElementById(threadElementId(commentId))?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
