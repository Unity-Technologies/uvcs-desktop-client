import { FileCode2 } from 'lucide-react';
import { useState } from 'react';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { navigation } from '../../../app/navigation/navigationStore';
import { Markdown } from '../../../components/Markdown';
import { Button } from '../../../ui/Button';
import { CommentComposer } from './CommentComposer';
import { canDiscard } from './commentPermissions';
import { discardChangeRequest, replyToComment } from './reviewCommentOperations';
import { ReviewCommentView } from './ReviewCommentView';
import type { ReviewThread } from './reviewThreads';
import { commentLocationPage, locationText, replyAction, threadBadges } from './threadBadges';
import styles from './ReviewConversation.module.css';

interface ReviewThreadCardProps {
  reviewId: number;
  thread: ReviewThread;
  user: string | undefined;
}

type Answering = 'reply' | 'discard' | null;

/**
 * A comment and its replies as one card: on a line, its file and line first (a click opens them in Changes), its kind
 * and where it stands; then a reply box, and Discard for a change request someone else asked for.
 */
export function ReviewThreadCard({ reviewId, thread, user }: ReviewThreadCardProps) {
  const place = usePlace();
  const [answering, setAnswering] = useState<Answering>(null);
  const { root, replies } = thread;
  const badges = threadBadges(thread);
  const anchor = root.anchor.kind === 'line' ? root.anchor : null;

  return (
    <section className={styles.thread} data-state={badges.state?.tone} id={threadElementId(root.id)}>
      {(anchor || badges.kind) && (
        <div className={styles.threadHeader}>
          {anchor && (
            <button type="button" className={styles.location} data-tip="Show in Changes" onClick={() => navigation.openPage(commentLocationPage(reviewId, anchor, root.changesetId))}>
              <FileCode2 size={13} aria-hidden />
              <span className={styles.locationPath}>{locationText(anchor).path}</span>
              <span className={styles.locationLine}>{locationText(anchor).line}</span>
            </button>
          )}
          <span className={styles.badges}>
            {badges.kind && <span className={styles.kindBadge}>{badges.kind}</span>}
            {badges.state && (
              <span className={styles.stateBadge} data-tone={badges.state.tone}>
                {badges.state.label}
                {badges.appliedIn !== undefined && <Markdown text={`cs:${badges.appliedIn}`} comment />}
              </span>
            )}
          </span>
        </div>
      )}
      <ReviewCommentView comment={root} thread={thread} user={user} />
      {replies.map((reply) => (
        <ReviewCommentView key={reply.id} comment={reply} thread={thread} user={user} action={replyAction(reply)} />
      ))}
      <div className={styles.answer}>
        {answering === 'reply' && (
          <CommentComposer
            draftKey={`review-reply:${root.guid}`}
            placeholder="Reply"
            label="Reply"
            submitLabel="Reply"
            autoFocus
            onSubmit={async (text) => {
              const sent = await replyToComment(place, root, text);
              if (sent) setAnswering(null);
              return sent;
            }}
            onCancel={() => setAnswering(null)}
          />
        )}
        {answering === 'discard' && (
          <CommentComposer
            draftKey={`review-discard:${root.guid}`}
            placeholder="Why isn't this change needed?"
            label="Why the change request is discarded"
            submitLabel="Discard change request"
            danger
            autoFocus
            onSubmit={async (text) => {
              const sent = await discardChangeRequest(place, root, text);
              if (sent) setAnswering(null);
              return sent;
            }}
            onCancel={() => setAnswering(null)}
          />
        )}
        {answering === null && (
          <div className={styles.answerButtons}>
            <button type="button" className={styles.replyPrompt} onClick={() => setAnswering('reply')}>
              Reply…
            </button>
            {canDiscard(thread, user) && (
              <Button size="small" variant="ghost" onClick={() => setAnswering('discard')}>
                Discard…
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** The thread's element, which a link to it scrolls to. */
export function threadElementId(commentId: number): string {
  return `review-thread-${commentId}`;
}
