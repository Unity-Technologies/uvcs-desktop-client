import { useState } from 'react';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/dialog/Dialog';
import { askDialog } from '../ui/dialog/dialogStore';
import { TextArea } from '../ui/TextField';

/**
 * Asks for a new (possibly multi-line) comment of an object, named as its title reads it (`changeset 12`, `shelve 3`).
 * Resolves to `undefined` if cancelled.
 */
export function askForComment(objectName: string, currentComment: string): Promise<string | undefined> {
  return askDialog<string>((finish) => <EditCommentDialog objectName={objectName} currentComment={currentComment} finish={finish} />);
}

interface EditCommentDialogProps {
  objectName: string;
  currentComment: string;
  finish: (comment: string | undefined) => void;
}

function EditCommentDialog({ objectName, currentComment, finish }: EditCommentDialogProps) {
  const [comment, setComment] = useState(currentComment);
  const unchanged = comment.trim() === currentComment.trim();

  return (
    <Dialog
      title={`Edit comment of ${objectName}`}
      width={560}
      onClose={() => finish(undefined)}
      onSubmit={() => !unchanged && finish(comment.trim())}
      footer={
        <>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={unchanged}>
            Save comment
          </Button>
        </>
      }
    >
      <TextArea
        label="Comment"
        value={comment}
        rows={8}
        autoFocus
        onChange={(event) => setComment(event.target.value)}
        onKeyDown={(event) => {
          // Enter adds lines; ⌘/Ctrl+Enter saves.
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) event.currentTarget.form?.requestSubmit();
        }}
      />
    </Dialog>
  );
}
