import type { CodeReview } from '@shared/domain/codeReview';
import { ReviewersSection } from './ReviewersSection';
import type { OpenItem } from './threadPick';
import { ThreadKindIcon } from './ThreadKindIcon';
import styles from './ReviewConversation.module.css';

interface ReviewSideRailProps {
  review: CodeReview;
  /** The change requests and questions still open, the one gone to last current (`openItemsOf`). */
  open: readonly OpenItem[];
  /** Goes to a thread in the conversation: scrolled to, lit and ringed (`pickThread`). */
  onPick: (threadId: number) => void;
}

/** Beside the conversation: who reviews it and the status each gave, and the change requests and questions still open. */
export function ReviewSideRail({ review, open, onPick }: ReviewSideRailProps) {
  return (
    <aside className={styles.rail}>
      <ReviewersSection review={review} />
      <section className={styles.railSection} aria-labelledby="review-open">
        <h2 id="review-open" className={styles.railTitle}>
          Open <span className={styles.railCount}>{open.length}</span>
        </h2>
        {open.length === 0 && <p className={styles.railEmpty}>Nothing left to answer</p>}
        <ul className={styles.openItems}>
          {open.map((item) => (
            <li key={item.threadId} className={styles.openItem} data-current={item.current || undefined}>
              <button type="button" className={styles.openItemPick} aria-current={item.current || undefined} onClick={() => onPick(item.threadId)}>
                <ThreadKindIcon root={item.thread.root} />
                <span className={styles.openText}>{item.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
