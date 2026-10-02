import { Copy, Pencil } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { splitComment, type CommentParts } from '../lib/comment';
import { copyToClipboard } from '../ui/copyToClipboard';
import { IconButton } from '../ui/IconButton';
import { CommentEditor } from './CommentEditor';
import { FoldedComment } from './FoldedComment';
import styles from './DetailsHeading.module.css';

interface DetailsHeadingProps {
  /** The object's name (a branch, a label). Without it the comment's first line is the title and the rest its description. */
  name?: ReactNode;
  comment?: string;
  /**
   * Saves an edited comment, resolving to false when it couldn't (the editor then stays open); without it the heading
   * is read-only (cm can't change every object's comment).
   */
  onSave?: (comment: string) => Promise<unknown>;
}

/**
 * The title and description at the top of a details panel, read like a commit message: the first line of the comment
 * as the title, the rest below it in muted text, folded when long. Editable in place where cm can edit the comment.
 */
export function DetailsHeading({ name, comment = '', onSave }: DetailsHeadingProps) {
  const [draft, setDraft] = useState<CommentParts | null>(null);
  const parts = name === undefined ? splitComment(comment) : { summary: '', description: comment.trim() };
  const edit = onSave ? () => setDraft(parts) : undefined;

  if (draft && onSave) {
    return (
      <div className={styles.heading} data-named={name !== undefined}>
        {name !== undefined && <h2 className={`${styles.title} selectable`}>{name}</h2>}
        <CommentEditor draft={draft} original={comment} opened={parts} withSummary={name === undefined} onChange={setDraft} onSave={onSave} onClose={() => setDraft(null)} />
      </div>
    );
  }

  return (
    <div className={styles.heading} data-named={name !== undefined} data-actions={Boolean(edit || comment.trim())}>
      <FoldedComment
        titleClassName={styles.title}
        titleLines={TITLE_LINES}
        descriptionLines={DESCRIPTION_LINES}
        title={
          name ??
          (parts.summary ||
            (edit ? (
              <button className={styles.add} onClick={edit}>
                No comment. Add one…
              </button>
            ) : (
              <span className={styles.placeholder}>No comment</span>
            )))
        }
        description={parts.description}
      >
        {name !== undefined && !parts.description && edit && (
          <button className={styles.add} onClick={edit}>
            Add a description…
          </button>
        )}
      </FoldedComment>
      <div className={styles.actions}>
        {comment.trim() && (
          <IconButton size="small" icon={<Copy size={12} strokeWidth={1.75} />} label="Copy comment" onClick={() => copyToClipboard(comment.trim(), 'Comment')} />
        )}
        {edit && <IconButton size="small" icon={<Pencil size={12} strokeWidth={1.75} />} label="Edit comment" onClick={edit} />}
      </div>
    </div>
  );
}

/** How much of the heading shows while folded (`FoldedComment`): the panel scrolls, so it shows more than a diff's header. */
const TITLE_LINES = 3;
const DESCRIPTION_LINES = 6;
