import type { CommentFieldHandle } from '../../../components/commentEditor/commentFieldProps';
import type { SegmentPick } from '../../../ui/segmentKeys';

/**
 * After a choice in a comment being written (its kind, or what on a model it's about), gives the focus back to the
 * comment's text, its caret where it was, when a click made it, so the writer goes on typing. Keys leave the focus on
 * the switch, so ← and → go on through the choices and Tab leads on from it, as in any radio group.
 */
export function focusFieldAfterPick(field: { readonly current: Pick<CommentFieldHandle, 'focus'> | null }, pick: SegmentPick): void {
  if (pick === 'pointer') field.current?.focus();
}
