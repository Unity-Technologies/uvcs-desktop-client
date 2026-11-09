import { CommentDialog } from '../../components/CommentDialog';
import { pluralize } from '../../lib/text';
import { askDialog } from '../../ui/dialog/dialogStore';

/**
 * Asks for the comment of a check-in from Files, of `count` changes. An empty comment may go as it is (whether to ask
 * about it is the setting's call). Resolves to `undefined` if cancelled.
 */
export function askForCheckinComment(count: number): Promise<string | undefined> {
  return askDialog<string>((finish) => (
    <CommentDialog title={`Check in ${pluralize(count, 'change')}`} confirmLabel="Check in" original="" submitsUnchanged finish={finish} />
  ));
}
