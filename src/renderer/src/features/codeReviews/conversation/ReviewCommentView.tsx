import { placeId } from '@shared/domain/place';
import { commentDraftKey } from '../../../components/DetailsHeading';
import { useEffect, useRef, useState } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { Markdown } from '../../../components/Markdown';
import { formatDateTime } from '../../../lib/formatDate';
import { displayName } from '../../../lib/userName';
import { Avatar } from '../../../ui/Avatar';
import { RelativeTime } from '../../../ui/RelativeTime';
import { CommentComposer } from './CommentComposer';
import { CommentMenuButton } from './CommentMenuButton';
import { editReviewComment } from './reviewCommentOperations';
import type { ReviewThread } from './reviewThreads';
import { useCommentMenu, type CommentThreadActions } from './useCommentMenu';
import styles from './ReviewConversation.module.css';

interface ReviewCommentViewProps {
  /** The review it's on: its link extends the review's; its change requests are marked applied in its changesets (`changesetsToApplyIn`). */
  review: Pick<CodeReview, 'id' | 'target'>;
  comment: ReviewComment;
  thread: ReviewThread;
  user: string | undefined;
  /** What the comment's header says after its author's name ("discarded it"), beside when. */
  action?: string;
  /** Whether its author wrote the review: marked Author, as who answers for the changes. */
  byReviewAuthor?: boolean;
  /** What its thread offers from the code, in a first comment's menu (`commentMenu`). */
  threadActions?: CommentThreadActions;
  /**
   * Gone to, the how-many-th time: lit for a moment, and scrolled to when it `scrolls` (the reply an Answered pill leads
   * to; a reply a link goes to is scrolled to by the conversation, `pickedElementId`).
   */
  lit?: { seq: number; scrolls: boolean };
  /** Its element's id, which going to it scrolls to (`commentElementId`): in the conversation only, as ids are unique. */
  elementId?: string;
}

/** One comment: who wrote it and when, its Markdown, and its menu; its author edits it in place. */
export function ReviewCommentView({ review, comment, thread, user, action, byReviewAuthor = false, threadActions, lit, elementId }: ReviewCommentViewProps) {
  const place = usePlace();
  const element = useRef<HTMLElement>(null);
  const litSeq = lit?.seq;
  const scrollsWhenLit = lit?.scrolls === true;
  useEffect(() => {
    if (litSeq !== undefined && scrollsWhenLit) element.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [litSeq, scrollsWhenLit]);
  const [editing, setEditing] = useState(false);
  const menu = useCommentMenu({ review, comment, thread, user, edit: () => setEditing(true), threadActions });

  return (
    <article ref={element} id={elementId} className={styles.comment} data-highlight={lit === undefined ? undefined : lit.seq % 2} aria-label={`${displayName(comment.author)}'s comment`}>
      <Avatar user={comment.author} size={24} />
      <div className={styles.commentBody}>
        <header className={styles.commentHeader}>
          <span className={styles.commentWho}>
            <span className={styles.author}>{displayName(comment.author)}</span>
            {action && <span className={styles.action}>{action}</span>}
            <RelativeTime date={comment.date} />
            {byReviewAuthor && <span className={styles.pill}>Author</span>}
            {comment.editedDate && (
              <span className={styles.edited} data-tip={`Edited ${formatDateTime(comment.editedDate)}`}>
                edited
              </span>
            )}
          </span>
          <CommentMenuButton entries={menu} />
        </header>
        {editing ? (
          <CommentComposer
            draftKey={commentDraftKey(placeId(place), 'reviewCommentEdit', comment.guid)}
            initialText={comment.text}
            placeholder="Write a comment"
            label="Edit comment"
            submitLabel="Save"
            autoFocus
            onSubmit={async (text) => {
              const saved = await editReviewComment(place, comment, text);
              if (saved) setEditing(false);
              return saved;
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className={`${styles.markdown} selectable`}>
            <Markdown text={comment.text} comment />
          </div>
        )}
      </div>
    </article>
  );
}
