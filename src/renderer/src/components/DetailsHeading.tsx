import { Copy, Pencil } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { editingParts, shownComment, type CommentParts, type SavedComment } from '../lib/comment';
import { copyToClipboard } from '../ui/copyToClipboard';
import { IconButton } from '../ui/IconButton';
import { CommentEditor } from './CommentEditor';
import { CommentLine } from './comments/CommentLine';
import { commentHeading } from '../lib/comments/commentHeading';
import { FoldedComment } from './FoldedComment';
import styles from './DetailsHeading.module.css';

interface DetailsHeadingProps {
  /** The object's name (a branch, a label). Without it the comment's first line is the title and the rest its description. */
  name?: ReactNode;
  comment?: string;
  /**
   * Saves an edited comment, resolving to whether it saved (one that couldn't stays in its editor); without it the
   * heading is read-only (cm can't change every object's comment).
   */
  onSave?: (comment: string) => Promise<boolean>;
}

/**
 * The title and description at the top of a details panel, read like a commit message: the first line of the comment
 * as the title, the rest below it in muted text, folded when long. Editable in place where cm can edit the comment;
 * a comment saved shows at once, not the old one until the refresh reads it (`shownComment`). Its panel is keyed by
 * the object, so what it saved never shows on another one.
 */
export function DetailsHeading({ name, comment: given = '', onSave }: DetailsHeadingProps) {
  const [draft, setDraft] = useState<CommentParts | null>(null);
  const [lastSaved, setLastSaved] = useState<SavedComment | null>(null);
  const comment = shownComment(given, lastSaved);
  const save = async (edited: string): Promise<boolean> => {
    const saved = (await onSave?.(edited)) === true;
    if (saved) setLastSaved({ saved: edited, replaced: given });
    return saved;
  };
  const parts = name === undefined ? editingParts(comment) : { summary: '', description: comment.trim() };
  const edit = onSave ? () => setDraft(parts) : undefined;
  // What shows (`commentHeading`): a named object's whole comment is its description.
  const shown = name === undefined ? commentHeading(comment) : parts.description ? ({ kind: 'block', description: parts.description } as const) : ({ kind: 'empty' } as const);

  if (draft && onSave) {
    return (
      <div className={styles.heading} data-named={name !== undefined}>
        {name !== undefined && <h2 className={`${styles.title} selectable`}>{name}</h2>}
        <CommentEditor draft={draft} original={comment} opened={parts} withSummary={name === undefined} onChange={setDraft} onSave={save} onClose={() => setDraft(null)} />
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
          (shown.kind === 'titled' ? (
            <CommentLine comment={comment} />
          ) : shown.kind === 'block' ? undefined : edit ? (
            <button className={styles.add} onClick={edit}>
              No comment. Add one…
            </button>
          ) : (
            <span className={styles.placeholder}>No comment</span>
          ))
        }
        description={shown.kind === 'empty' ? '' : shown.description}
        // A named object's title is its name, not part of its comment.
        comment={name === undefined && shown.kind !== 'empty' ? comment : undefined}
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
