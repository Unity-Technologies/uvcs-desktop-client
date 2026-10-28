import { useState } from 'react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { CommentArea } from '../../components/commentEditor/CommentArea';
import { storedComment } from '../../lib/comment';

/** Asks for a new (possibly multi-line) changeset comment. Resolves to `undefined` if cancelled. */
export function askForChangesetComment(changesetId: number, currentComment: string): Promise<string | undefined> {
  return askDialog<string>((finish) => <EditCommentDialog changesetId={changesetId} currentComment={currentComment} finish={finish} />);
}

interface EditCommentDialogProps {
  changesetId: number;
  currentComment: string;
  finish: (comment: string | undefined) => void;
}

function EditCommentDialog({ changesetId, currentComment, finish }: EditCommentDialogProps) {
  const [comment, setComment] = useState(currentComment);
  const unchanged = storedComment(comment) === storedComment(currentComment);

  return (
    <Dialog
      title={`Edit comment of changeset ${changesetId}`}
      width={560}
      onClose={() => finish(undefined)}
      onSubmit={() => !unchanged && finish(storedComment(comment))}
      footer={
        <>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={unchanged}>
            Save comment
          </Button>
        </>
      }
    >
      {/* Enter adds lines; ⌘↵ saves, submitting the dialog. */}
      <CommentArea label="Comment" tall value={comment} placeholder="What changed and why" autoFocus onChange={setComment} />
    </Dialog>
  );
}
