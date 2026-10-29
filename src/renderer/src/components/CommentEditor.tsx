import { useRef, useState, type KeyboardEvent } from 'react';
import { confirm } from '../ui/dialog/confirm';
import { DESCRIPTION_PLACEHOLDER } from './commentEditor/commentPlaceholders';
import { CommentField } from './commentEditor/CommentField';
import { CommentFocusGroup } from './commentEditor/CommentFocusGroup';
import { focusModeFor, type CommentSurface } from './commentEditor/focusModeSurfaces';
import type { CommentFieldHandle } from './commentEditor/commentFieldProps';
import { commentEditorExit, editedComment, hasUnsavedEdit, withSummaryText, type CommentParts } from '../lib/comment';
import { hotkey } from '../lib/shortcutRegistry';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import styles from './CommentEditor.module.css';

interface CommentEditorProps {
  draft: CommentParts;
  /** A changeset's (a title over its description, as the check-in writes it) or a named object's (one description). */
  surface: Extract<CommentSurface, 'changesetDetails' | 'namedObjectDetails'>;
  original: string;
  /** The parts the editor opened with: while the draft still reads them, saving leaves the comment as it was. */
  opened: CommentParts;
  onChange: (draft: CommentParts) => void;
  /** Resolves to whether it saved. */
  onSave: (comment: string) => Promise<boolean>;
  onClose: () => void;
}

/**
 * A summary field and a description, like the checkin composer: ⌘↵ saves, Escape cancels, an empty comment is fine.
 * Both grow with their text, so a comment written as one long line reads whole in its summary field.
 */
export function CommentEditor({ draft, surface, original, opened, onChange, onSave, onClose }: CommentEditorProps) {
  const [saving, setSaving] = useState(false);
  // A changeset's title and description are one larger editor, as the check-in's (`CommentFocusGroup`).
  const withSummary = focusModeFor(surface).title;
  const descriptionRef = useRef<CommentFieldHandle>(null);

  const edited = hasUnsavedEdit(original, opened, draft);
  // Esc and Cancel ask before throwing an edit away (`commentEditorExit`), as Edit comment does.
  const cancel = async (): Promise<void> => {
    if (commentEditorExit(edited, 'cancel') === 'close' || (await confirm(DISCARD_QUESTION))) onClose();
  };

  const save = async (): Promise<void> => {
    const comment = editedComment(original, opened, draft);
    if (comment !== original) {
      setSaving(true);
      const saved = await onSave(comment);
      setSaving(false);
      // A comment that couldn't be saved stays to try again (the failure shows as a toast).
      if (!saved) return;
    }
    onClose();
  };

  // ⌘↵ is each field's own (`onSubmit`); Esc, once the field has closed its suggestions, reaches here.
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    void cancel();
  };

  return (
    <div className={styles.editor} onKeyDown={onKeyDown}>
      <CommentFocusGroup>
      {withSummary && (
        <CommentField
          singleLine
          groupField="summary"
          className={styles.summaryField}
          value={draft.summary}
          placeholder="Summary"
          label="Summary"
          autoFocus
          disabled={saving}
          onChange={(text) => onChange(withSummaryText(draft, text))}
          onEnter={() => descriptionRef.current?.focus()}
          onSubmit={() => void save()}
        />
      )}
      <CommentField
        ref={descriptionRef}
        groupField="description"
        autoFocus={!withSummary}
        className={styles.descriptionField}
        value={draft.description}
        placeholder={DESCRIPTION_PLACEHOLDER}
        label="Description"
        disabled={saving}
        onChange={(text) => onChange({ ...draft, description: text })}
        onSubmit={() => void save()}
      />
      </CommentFocusGroup>
      <div className={styles.footer}>
        <span className={styles.hint}>
          <Kbd keys={hotkey('saveComment')} /> to save · Esc to cancel
        </span>
        <Button size="small" variant="ghost" onClick={() => void cancel()} disabled={saving}>
          Cancel
        </Button>
        <Button size="small" variant="primary" onClick={() => void save()} loading={saving} disabled={!edited}>
          Save
        </Button>
      </div>
    </div>
  );
}

/** The question before an edit is thrown away, the same in Edit comment (`EditCommentDialog`). */
export const DISCARD_QUESTION = { title: 'Discard your changes to this comment?', message: 'What you wrote here is lost.', confirmLabel: 'Discard', danger: true } as const;
