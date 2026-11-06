import { CircleHelp, GitPullRequestArrow } from 'lucide-react';
import type { CodeReview } from '@shared/domain/codeReview';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { commentLineText } from '../../../lib/comments/commentText';
import { displayName } from '../../../lib/userName';
import { Avatar } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { addReviewers } from '../codeReviewOperations';
import { CodeReviewStatusBadge } from '../CodeReviewStatusBadge';
import { threadElementId } from './ReviewThreadCard';
import type { ReviewThread } from './reviewThreads';
import { openItemKind } from './threadBadges';
import styles from './ReviewConversation.module.css';

/** Beside the conversation: who reviews it and the status each gave, and the change requests and questions still open. */
export function ReviewSideRail({ review, open }: { review: CodeReview; open: readonly ReviewThread[] }) {
  const place = usePlace();
  return (
    <aside className={styles.rail}>
      <section className={styles.railSection} aria-labelledby="review-reviewers">
        <h2 id="review-reviewers" className={styles.railTitle}>
          Reviewers
        </h2>
        {review.reviewers.length === 0 && <p className={styles.railEmpty}>Nobody yet</p>}
        <ul className={styles.reviewers}>
          {review.reviewers.map((reviewer) => (
            <li key={reviewer.name} className={styles.reviewer}>
              <Avatar user={reviewer.name} size={20} />
              <span className={styles.reviewerName}>{displayName(reviewer.name)}</span>
              <CodeReviewStatusBadge status={reviewer.status} compact />
            </li>
          ))}
        </ul>
        <Button size="small" variant="ghost" onClick={() => void addReviewers(place, review)}>
          Add reviewers…
        </Button>
      </section>
      <section className={styles.railSection} aria-labelledby="review-open">
        <h2 id="review-open" className={styles.railTitle}>
          Open <span className={styles.railCount}>{open.length}</span>
        </h2>
        {open.length === 0 && <p className={styles.railEmpty}>Nothing left to answer</p>}
        <ul className={styles.openItems}>
          {open.map(({ root }) => (
            <li key={root.id}>
              <button type="button" className={styles.openItem} onClick={() => scrollToThread(root.id)}>
                <OpenItemIcon kind={openItemKind(root)} />
                <span className={styles.openText}>{commentLineText(root.text)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

const OPEN_ITEM_ICONS = { Question: CircleHelp, 'Change request': GitPullRequestArrow } as const;

function OpenItemIcon({ kind }: { kind: ReturnType<typeof openItemKind> }) {
  const Icon = OPEN_ITEM_ICONS[kind];
  return <Icon size={13} aria-label={kind} />;
}

function scrollToThread(commentId: number): void {
  document.getElementById(threadElementId(commentId))?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
