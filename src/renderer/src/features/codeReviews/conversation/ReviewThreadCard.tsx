import { ChevronRight } from 'lucide-react';
import { placeId } from '@shared/domain/place';
import type { CodeReview } from '@shared/domain/codeReview';
import { isAuthor } from '../reviewers';
import { commentDraftKey } from '../../../components/DetailsHeading';
import { useState } from 'react';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { navigation } from '../../../app/navigation/navigationStore';
import { CommentLine } from '../../../components/comments/CommentLine';
import { displayName } from '../../../lib/userName';
import { Avatar } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { CommentComposer } from './CommentComposer';
import { canDiscard } from './commentPermissions';
import { discardChangeRequest, replyToComment } from './reviewCommentOperations';
import { ReviewCommentView } from './ReviewCommentView';
import type { ReviewThread } from './reviewThreads';
import { commentLocationPage, locationText, replyAction, repliesText, startsFolded, threadBadges, type ThreadBadges } from './threadBadges';
import { openChangesetDiff } from '../../changesets/changesetOperations';
import { ThreadKindIcon } from './ThreadKindIcon';
import styles from './ReviewConversation.module.css';

interface ReviewThreadCardProps {
  review: Pick<CodeReview, 'id' | 'owner'>;
  thread: ReviewThread;
  user: string | undefined;
}

type Answering = 'reply' | 'discard' | null;

/**
 * A comment and its replies as one card. A change request or a question has a header band: its kind's icon, its file
 * and line on a line (a click opens them in Changes), and where it stands as a pill. A settled one starts folded to that line and
 * its first words (`startsFolded`); a click shows it whole.
 */
export function ReviewThreadCard({ review, thread, user }: ReviewThreadCardProps) {
  const [folded, setFolded] = useState(() => startsFolded(thread));
  const badges = threadBadges(thread);
  const foldable = startsFolded(thread);
  const hasHeader = thread.root.anchor.kind === 'line' || badges.kind !== undefined;

  return (
    <section className={styles.thread} data-folded={folded} id={threadElementId(thread.root.id)}>
      {hasHeader && <ThreadHeader reviewId={review.id} thread={thread} folded={folded} onToggle={foldable ? () => setFolded(!folded) : undefined} />}
      <div className={styles.threadBody}>
        {folded ? <FoldedThread thread={thread} onOpen={() => setFolded(false)} /> : <WholeThread review={review} thread={thread} user={user} />}
      </div>
    </section>
  );
}

interface ThreadHeaderProps {
  reviewId: number;
  thread: ReviewThread;
  folded: boolean;
  /** Folds or unfolds a settled thread; none for one that stays whole. */
  onToggle?: () => void;
}

function ThreadHeader({ reviewId, thread, folded, onToggle }: ThreadHeaderProps) {
  const { root } = thread;
  const badges = threadBadges(thread);
  const anchor = root.anchor.kind === 'line' ? root.anchor : null;
  const location = anchor && locationText(anchor);
  const replies = folded ? repliesText(thread) : undefined;

  return (
    <div className={styles.threadHeader}>
      {onToggle && (
        <button type="button" className={styles.foldToggle} aria-expanded={!folded} aria-label={folded ? 'Show the thread' : 'Fold the thread'} onClick={onToggle}>
          <ChevronRight size={14} aria-hidden />
        </button>
      )}
      {badges.kind && <ThreadKindIcon root={root} />}
      {anchor && location && (
        <button type="button" className={styles.location} data-tip="Show in Changes" onClick={() => navigation.openPage(commentLocationPage(reviewId, anchor, root.changesetId))}>
          <span className={styles.locationFolder}>{location.folder}</span>
          <span className={styles.locationFile}>{location.file}</span>
          <span className={styles.locationLine}>{location.line}</span>
        </button>
      )}
      <span className={styles.headerEnd}>
        {replies && <span className={styles.replyCount}>{replies}</span>}
        {badges.state && (
          <StatePill state={badges.state} appliedIn={badges.appliedIn} />
        )}
      </span>
    </div>
  );
}

/**
 * Where a thread stands, as an outlined pill. "Applied in 281299" is one link as a whole, opening the changeset that
 * applied it: a chip inside the pill would be a frame in a frame.
 */
function StatePill({ state, appliedIn }: { state: NonNullable<ThreadBadges['state']>; appliedIn: number | undefined }) {
  if (appliedIn === undefined) {
    return (
      <span className={styles.pill} data-tone={state.tone}>
        {state.label}
      </span>
    );
  }
  return (
    <button type="button" className={styles.pill} data-tone={state.tone} data-tip={`Open changeset ${appliedIn}`} onClick={() => openChangesetDiff({ id: appliedIn })}>
      {state.label} {appliedIn}
    </button>
  );
}

/** A settled thread folded: who started it and its first words, a click showing it whole. */
function FoldedThread({ thread, onOpen }: { thread: ReviewThread; onOpen: () => void }) {
  const { root } = thread;
  return (
    <button type="button" className={styles.foldedLine} onClick={onOpen}>
      <Avatar user={root.author} size={16} tip={null} />
      <span className={styles.author}>{displayName(root.author)}</span>
      <span className={styles.foldedText}>
        <CommentLine comment={root.text} interactive={false} />
      </span>
    </button>
  );
}

/** Every comment of the thread, then a reply box, and Discard for a change request someone else asked for. */
function WholeThread({ review, thread, user }: { review: Pick<CodeReview, 'owner'>; thread: ReviewThread; user: string | undefined }) {
  const place = usePlace();
  const [answering, setAnswering] = useState<Answering>(null);
  const { root, replies } = thread;

  return (
    <>
      <ReviewCommentView comment={root} thread={thread} user={user} byReviewAuthor={isAuthor(review, root.author)} />
      {replies.map((reply) => (
        <ReviewCommentView key={reply.id} comment={reply} thread={thread} user={user} action={replyAction(reply)} byReviewAuthor={isAuthor(review, reply.author)} />
      ))}
      <div className={styles.answer}>
        {answering === 'reply' && (
          <CommentComposer
            draftKey={commentDraftKey(placeId(place), 'reviewReply', root.guid)}
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
            draftKey={commentDraftKey(placeId(place), 'reviewDiscard', root.guid)}
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
    </>
  );
}

/** The thread's element, which a link to it scrolls to. */
export function threadElementId(commentId: number): string {
  return `review-thread-${commentId}`;
}
