import { askDialog } from '../ui/dialog/dialogStore';
import { CommentDialog } from './CommentDialog';

/**
 * Asks for a new (possibly multi-line) comment of an object, named as its title reads it (`changeset 12`, `shelve 3`).
 * Saving with no edit writes nothing, so it can't be submitted unchanged. Resolves to `undefined` if cancelled.
 */
export function askForComment(objectName: string, currentComment: string): Promise<string | undefined> {
  return askDialog<string>((finish) => (
    <CommentDialog
      title={`Edit comment of ${objectName}`}
      confirmLabel="Save comment"
      original={currentComment}
      submitsUnchanged={false}
      finish={finish}
    />
  ));
}
