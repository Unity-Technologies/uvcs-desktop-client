import { MoreHorizontal } from 'lucide-react';
import type { CodeReview } from '@shared/domain/codeReview';
import { placeId } from '@shared/domain/place';
import { commentDraftKey } from '../../../components/DetailsHeading';
import { useEffect, useRef, useState } from 'react';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { Markdown } from '../../../components/Markdown';
import { formatDateTime } from '../../../lib/formatDate';
import { displayName } from '../../../lib/userName';
import { Avatar } from '../../../ui/Avatar';
import { copyToClipboard } from '../../../ui/copyToClipboard';
import { IconButton } from '../../../ui/IconButton';
import { ActionDropdownMenu } from '../../../ui/menu/ActionDropdownMenu';
import { RelativeTime } from '../../../ui/RelativeTime';
import { CommentComposer } from './CommentComposer';
import { commentMenu } from './commentMenu';
import { deleteReviewComment, editReviewComment, markChangeRequest } from './reviewCommentOperations';
import type { ReviewThread } from './reviewThreads';
import styles from './ReviewConversation.module.css';

interface ReviewCommentViewProps {
  /** What a change request is marked applied in: its changesets, a branch's review's (`changesetsToApplyIn`). */
  review: Pick<CodeReview, 'target'>;
  comment: ReviewComment;
  thread: ReviewThread;
  user: string | undefined;
  /** What the comment's header says after its author's name ("discarded it"), beside when. */
  action?: string;
  /** Whether its author wrote the review: marked Author, as who answers for the changes. */
  byReviewAuthor?: boolean;
  /** What its thread offers from the code, in a first comment's menu (`commentMenu`). */
  threadActions?: Pick<Parameters<typeof commentMenu>[3], 'showInConversation'>;
  /** Gone to, the how-many-th time (the reply an Answered pill leads to): scrolled to and lit for a moment. */
  lit?: number;
}

/** One comment: who wrote it and when, its Markdown, and its menu; its author edits it in place. */
export function ReviewCommentView({ review, comment, thread, user, action, byReviewAuthor = false, threadActions, lit }: ReviewCommentViewProps) {
  const place = usePlace();
  const element = useRef<HTMLElement>(null);
  useEffect(() => {
    if (lit !== undefined) element.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [lit]);
  const [editing, setEditing] = useState(false);
  const menu = commentMenu(comment, thread, user, {
    edit: () => setEditing(true),
    remove: () => void deleteReviewComment(place, comment),
    copyText: () => copyToClipboard(comment.text, 'Comment'),
    markChangeRequest: (mark) => void markChangeRequest(place, review, comment, mark),
    ...threadActions,
  });

  return (
    <article ref={element} className={styles.comment} data-highlight={lit === undefined ? undefined : lit % 2} aria-label={`${displayName(comment.author)}'s comment`}>
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
          <span className={styles.commentMenu}>
            <ActionDropdownMenu entries={menu}>
              <IconButton size="small" icon={<MoreHorizontal size={14} />} label="Comment actions" />
            </ActionDropdownMenu>
          </span>
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
