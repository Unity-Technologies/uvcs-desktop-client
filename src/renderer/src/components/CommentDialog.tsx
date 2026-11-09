import { useMemo, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/dialog/Dialog';
import { CommentArea } from './commentEditor/CommentArea';
import { CommentFocusGroup } from './commentEditor/CommentFocusGroup';
import type { CommentFieldHandle } from './commentEditor/commentFieldProps';
import { DESCRIPTION_PLACEHOLDER } from './commentEditor/commentPlaceholders';
import { commentEditorExit, editedComment, editingParts, hasUnsavedEdit, storedComment, withSummaryText } from '../lib/comment';
import { DISCARD_QUESTION } from './CommentEditor';
import { confirm } from '../ui/dialog/confirm';

export interface CommentDialogProps {
  title: string;
  confirmLabel: string;
  /** The comment it opens with: what an edit is measured against. */
  original: string;
  /** Whether it submits with no edit: a check-in's empty comment may go as it is; an unedited comment saves nothing. */
  submitsUnchanged: boolean;
  finish: (comment: string | undefined) => void;
}

/**
 * A comment as the check-in writes it: a title and a description (`editingParts`, one focus mode for both), saved as
 * the check-in joins them, the original's line ends kept (`editedComment`). A comment opening with a list, a table or
 * code opens whole in the description. Edit comment (`askForComment`) is the one most places open.
 */
export function CommentDialog({ title, confirmLabel, original, submitsUnchanged, finish }: CommentDialogProps) {
  const opened = useMemo(() => editingParts(original), [original]);
  const [draft, setDraft] = useState(opened);
  const description = useRef<CommentFieldHandle>(null);
  const comment = storedComment(editedComment(original, opened, draft));
  const unchanged = !hasUnsavedEdit(original, opened, draft);
  const submittable = submitsUnchanged || !unchanged;
  // Esc and Cancel ask before throwing an edit away; with nothing changed they close at once.
  const cancel = async (): Promise<void> => {
    if (commentEditorExit(!unchanged, 'cancel') === 'close' || (await confirm(DISCARD_QUESTION))) finish(undefined);
  };

  return (
    <Dialog
      title={title}
      width={560}
      onClose={() => void cancel()}
      onSubmit={() => submittable && finish(comment)}
      footer={
        <>
          <Button onClick={() => void cancel()}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!submittable}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {/* Enter goes on to the description; ⌘↵ submits the dialog. */}
      <CommentFocusGroup>
        <CommentArea
          label="Summary"
          singleLine
          groupField="summary"
          value={draft.summary}
          placeholder="Summary"
          autoFocus
          onChange={(text) => setDraft(withSummaryText(draft, text))}
          onEnter={() => description.current?.focusAtStart()}
        />
        <CommentArea
          ref={description}
          label="Description"
          tall
          groupField="description"
          value={draft.description}
          placeholder={DESCRIPTION_PLACEHOLDER}
          onChange={(text) => setDraft({ ...draft, description: text })}
        />
      </CommentFocusGroup>
    </Dialog>
  );
}
