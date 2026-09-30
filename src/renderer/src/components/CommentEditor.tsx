import { useRef, useState, type KeyboardEvent } from 'react';
import { editedComment, withSummaryText, type CommentParts } from '../lib/comment';
import { hotkey } from '../lib/shortcutRegistry';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import styles from './CommentEditor.module.css';

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
export function CommentEditor({ draft, withSummary, original, opened, onChange, onSave, onClose }: CommentEditorProps) {
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
