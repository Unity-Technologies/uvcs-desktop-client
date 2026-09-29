import { Copy, Pencil } from 'lucide-react';
import { copyToClipboard } from '../lib/copyToClipboard';
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { editedComment, looksLikeMarkdown, splitComment, withSummaryText, type CommentParts } from '../lib/comment';
import { hotkey } from '../lib/shortcutRegistry';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Kbd } from '../ui/Kbd';
import { Markdown } from './Markdown';
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
      <Folded
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
        onAddDescription={name !== undefined && !parts.description ? edit : undefined}
      />
      <div className={styles.actions}>
        {comment.trim() && (
          <IconButton size="small" icon={<Copy size={12} strokeWidth={1.75} />} label="Copy comment" onClick={() => copyToClipboard(comment.trim(), 'Comment')} />
        )}
        {edit && <IconButton size="small" icon={<Pencil size={12} strokeWidth={1.75} />} label="Edit comment" onClick={edit} />}
      </div>
    </div>
  );
}

const TITLE_LINES = 3;

/** The title (up to three lines) and description (a few lines), with one "Show more" once either doesn't fit. */
function Folded({ title, description, onAddDescription }: { title: ReactNode; description: string; onAddDescription?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  // What was cut while folded; stays known once expanded, so "Show less" stays too.
  const [cut, setCut] = useState({ title: false, description: false });
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const isCut = (element: HTMLElement | null): boolean => Boolean(element && element.scrollHeight - element.clientHeight > 2);
    const measure = (): void =>
      setCut((current) => {
        const next = { title: current.title || isCut(titleRef.current), description: current.description || isCut(descriptionRef.current) };
        return next.title === current.title && next.description === current.description ? current : next;
      });
    measure();
    const observer = new ResizeObserver(measure);
    for (const element of [titleRef.current, descriptionRef.current]) if (element) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.folded} data-expanded={expanded}>
      <h2 ref={titleRef} className={`${styles.title} selectable`} style={{ WebkitLineClamp: expanded ? 'none' : TITLE_LINES }}>
        {title}
      </h2>
      {description && (
        <div ref={descriptionRef} className={`${styles.description} selectable`} data-cut={cut.description}>
          {looksLikeMarkdown(description) ? <Markdown text={description} /> : <p className={styles.plain}>{description}</p>}
        </div>
      )}
      {onAddDescription && (
        <button className={styles.add} onClick={onAddDescription}>
          Add a description…
        </button>
      )}
      {(cut.title || cut.description) && (
        <button className={styles.toggle} onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

interface CommentEditorProps {
  draft: CommentParts;
  /** False where the title is the object's name: the whole comment is the description. */
  withSummary: boolean;
  original: string;
  /** The parts the editor opened with: while the draft still reads them, saving leaves the comment as it was. */
  opened: CommentParts;
  onChange: (draft: CommentParts) => void;
  onSave: (comment: string) => Promise<unknown>;
  onClose: () => void;
}

/**
 * A summary field and a description, like the checkin composer: ⌘↵ saves, Escape cancels, an empty comment is fine.
 * Both grow with their text, so a comment written as one long line reads whole in its summary field.
 */
function CommentEditor({ draft, withSummary, original, opened, onChange, onSave, onClose }: CommentEditorProps) {
  const [saving, setSaving] = useState(false);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const save = async (): Promise<void> => {
    const comment = editedComment(original, opened, draft);
    if (comment !== original) {
      setSaving(true);
      const saved = await onSave(comment);
      setSaving(false);
      // A comment that couldn't be saved stays to try again (the failure shows as a toast).
      if (saved === false) return;
    }
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void save();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    } else if (event.key === 'Enter' && event.target === summaryRef.current) {
      event.preventDefault();
      descriptionRef.current?.focus();
    }
  };

  return (
    <div className={styles.editor} onKeyDown={onKeyDown}>
      {withSummary && (
        <textarea
          ref={summaryRef}
          className={styles.summaryField}
          value={draft.summary}
          rows={1}
          placeholder="Summary"
          aria-label="Summary"
          autoFocus
          disabled={saving}
          spellCheck
          onChange={(event) => onChange(withSummaryText(draft, event.target.value))}
        />
      )}
      <textarea
        ref={descriptionRef}
        autoFocus={!withSummary}
        className={styles.descriptionField}
        value={draft.description}
        placeholder="Description (optional)"
        aria-label="Description"
        disabled={saving}
        spellCheck
        onChange={(event) => onChange({ ...draft, description: event.target.value })}
      />
      <div className={styles.footer}>
        <span className={styles.hint}>
          <Kbd keys={hotkey('saveComment')} /> to save · Esc to cancel
        </span>
        <Button size="small" variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button size="small" variant="primary" onClick={() => void save()} loading={saving}>
          Save
        </Button>
      </div>
    </div>
  );
}
