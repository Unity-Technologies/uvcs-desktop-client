import { Pencil } from 'lucide-react';
import { useState } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import type { ReviewDescription } from '@shared/domain/reviewConversation';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { Markdown } from '../../../components/Markdown';
import { displayName } from '../../../lib/userName';
import { Avatar } from '../../../ui/Avatar';
import { IconButton } from '../../../ui/IconButton';
import { RelativeTime } from '../../../ui/RelativeTime';
import { CommentComposer } from './CommentComposer';
import { saveReviewDescription } from './reviewCommentOperations';
import styles from './ReviewConversation.module.css';

/**
 * The review's description, first in its conversation, as its author wrote it: edited in place, written where there's
 * none ("Add a description"), emptied to clear it.
 */
export function ReviewDescriptionCard({ review, description }: { review: CodeReview; description: ReviewDescription | undefined }) {
  const place = usePlace();
  const [editing, setEditing] = useState(false);
  const author = description?.author ?? review.owner;

  return (
    <article className={styles.description} aria-label="Description">
      <Avatar user={author} size={28} />
      <div className={styles.commentBody}>
        <header className={styles.commentHeader}>
          <span className={styles.author}>{displayName(author)}</span>
          <RelativeTime date={description?.date ?? review.date} />
          {description?.editedDate && <span className={styles.edited}>edited</span>}
          {!editing && (
            <span className={styles.commentMenu}>
              <IconButton size="small" icon={<Pencil size={13} />} label={description ? 'Edit description' : 'Add a description'} onClick={() => setEditing(true)} />
            </span>
          )}
        </header>
        {editing ? (
          <CommentComposer
            draftKey={`review-description:${review.id}`}
            initialText={description?.text ?? ''}
            placeholder="What these changes do, and what to look at"
            label="Description"
            submitLabel="Save"
            allowEmpty
            autoFocus
            onSubmit={async (text) => {
              const saved = await saveReviewDescription(place, review.id, text);
              if (saved) setEditing(false);
              return saved;
            }}
            onCancel={() => setEditing(false)}
          />
        ) : description?.text.trim() ? (
          <div className={`${styles.markdown} selectable`}>
            <Markdown text={description.text} comment />
          </div>
        ) : (
          <button type="button" className={styles.noDescription} onClick={() => setEditing(true)}>
            No description. Add one…
          </button>
        )}
      </div>
    </article>
  );
}
