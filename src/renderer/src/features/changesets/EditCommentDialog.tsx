import { useMemo, useRef, useState } from 'react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { CommentArea } from '../../components/commentEditor/CommentArea';
import { CommentFocusGroup } from '../../components/commentEditor/CommentFocusGroup';
import type { CommentFieldHandle } from '../../components/commentEditor/commentFieldProps';
import { DESCRIPTION_PLACEHOLDER } from '../../components/commentEditor/commentPlaceholders';
import { editedComment, editingParts, storedComment, withSummaryText } from '../../lib/comment';

/** Asks for a new (possibly multi-line) changeset comment. Resolves to `undefined` if cancelled. */
export function askForChangesetComment(changesetId: number, currentComment: string): Promise<string | undefined> {
  return askDialog<string>((finish) => <EditCommentDialog changesetId={changesetId} currentComment={currentComment} finish={finish} />);
}

interface EditCommentDialogProps {
  changesetId: number;
  currentComment: string;
  finish: (comment: string | undefined) => void;
}

/**
 * A changeset's comment as the check-in writes it: a title and a description (`editingParts`, one focus mode for both),
 * saved as the check-in joins them, the original's line ends kept (`editedComment`). A comment opening with a list, a
 * table or code opens whole in the description. Saving with no edit writes nothing. No Recent comments here: they're
 * comments to check in with, not to give a changeset already made.
 */
function EditCommentDialog({ changesetId, currentComment, finish }: EditCommentDialogProps) {
  const opened = useMemo(() => editingParts(currentComment), [currentComment]);
  const [draft, setDraft] = useState(opened);
  const description = useRef<CommentFieldHandle>(null);
  const comment = storedComment(editedComment(currentComment, opened, draft));
  const unchanged = comment === storedComment(currentComment);

  return (
    <Dialog
      title={`Edit comment of changeset ${changesetId}`}
      width={560}
      onClose={() => finish(undefined)}
      onSubmit={() => !unchanged && finish(comment)}
      footer={
        <>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={unchanged}>
            Save comment
          </Button>
        </>
      }
    >
      {/* Enter goes on to the description; ⌘↵ saves, submitting the dialog. */}
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
