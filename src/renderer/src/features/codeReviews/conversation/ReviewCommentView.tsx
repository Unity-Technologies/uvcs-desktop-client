import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
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
import { deleteReviewComment, editReviewComment } from './reviewCommentOperations';
import type { ReviewThread } from './reviewThreads';
import styles from './ReviewConversation.module.css';

interface ReviewCommentViewProps {
  comment: ReviewComment;
  thread: ReviewThread;
  user: string | undefined;
  /** What the comment's header says after its author's name ("discarded it"), beside when. */
  action?: string;
}

/** One comment: who wrote it and when, its Markdown, and its menu; its author edits it in place. */
export function ReviewCommentView({ comment, thread, user, action }: ReviewCommentViewProps) {
  const place = usePlace();
  const [editing, setEditing] = useState(false);
  const menu = commentMenu(comment, thread, user, {
    edit: () => setEditing(true),
    remove: () => void deleteReviewComment(place, comment),
    copyText: () => copyToClipboard(comment.text, 'Comment'),
  });

  return (
    <article className={styles.comment} aria-label={`${displayName(comment.author)}'s comment`}>
      <Avatar user={comment.author} size={24} />
      <div className={styles.commentBody}>
        <header className={styles.commentHeader}>
          <span className={styles.author}>{displayName(comment.author)}</span>
          {action && <span className={styles.action}>{action}</span>}
          <RelativeTime date={comment.date} />
          {comment.editedDate && (
            <span className={styles.edited} data-tip={`Edited ${formatDateTime(comment.editedDate)}`}>
              edited
            </span>
          )}
          <span className={styles.commentMenu}>
            <ActionDropdownMenu entries={menu}>
              <IconButton size="small" icon={<MoreHorizontal size={14} />} label="Comment actions" />
            </ActionDropdownMenu>
          </span>
        </header>
        {editing ? (
          <CommentComposer
            draftKey={`review-comment-edit:${comment.guid}`}
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
