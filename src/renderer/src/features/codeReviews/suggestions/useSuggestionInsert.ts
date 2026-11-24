import { useEffect, useState, type RefObject } from 'react';
import type { CommentFieldHandle } from '../../../components/commentEditor/commentFieldProps';
import { useCommentDraftStore } from '../../../components/commentDraftStore';
import { withSuggestionInserted } from './suggestButton';

/**
 * Suggest change in a comment's editor (a new comment's card, a change request edited): inserts the fence of `lines`
 * at the caret of the draft `draftKey` holds (`withSuggestionInserted`), and puts the caret back inside it once the
 * field shows the new text, which it takes on its next render. Returns what was inserted, its kind included.
 */
export function useSuggestionInsert(field: RefObject<CommentFieldHandle | null>, draftKey: string, text: string): (lines: readonly string[]) => ReturnType<typeof withSuggestionInserted> {
  const [caretAfterInsert, setCaretAfterInsert] = useState<number | null>(null);
  useEffect(() => {
    if (caretAfterInsert === null) return;
    if (field.current?.focusAtSelection({ anchor: caretAfterInsert, head: caretAfterInsert }) !== false) setCaretAfterInsert(null);
  });
  return (lines) => {
    const inserted = withSuggestionInserted(text, field.current?.selection()?.head ?? text.length, lines);
    useCommentDraftStore.getState().keep(draftKey, { summary: '', description: inserted.text });
    setCaretAfterInsert(inserted.caret);
    return inserted;
  };
}
