import { MessageSquareDiff } from 'lucide-react';
import type { RefObject } from 'react';
import type { CommentFieldHandle } from '../../../components/commentEditor/commentFieldProps';
import { useCommentDraftStore } from '../../../components/commentDraftStore';
import { Button } from '../../../ui/Button';
import { Tooltip } from '../../../ui/Tooltip';
import { composerText } from '../conversation/composerText';
import { anchorPath, type LineAnchor } from '../inline/fileThreads';
import { suggestButtonOf } from './suggestButton';
import { useReplacedLines } from './useReplacedLines';
import { useSuggestionInsert } from './useSuggestionInsert';

interface EditSuggestButtonProps {
  anchor: LineAnchor;
  /** The comment's text as posted, the editor's until it's changed. */
  postedText: string;
  draftKey: string;
  field: RefObject<CommentFieldHandle | null>;
}

/**
 * Suggest change in a change request's header while it's edited (`editOffersSuggestion`), beside its menu, as no
 * row of its own above the editor: the fence inserted at the caret, filled with the
 * commented lines (`useReplacedLines`, the diff's own read), as a new comment's Suggest change does. Disabled, saying
 * why, while the lines are read, when they can't be, and once the text suggests already (`suggestButtonOf`).
 */
export function EditSuggestButton({ anchor, postedText, draftKey, field }: EditSuggestButtonProps) {
  const text = composerText(useCommentDraftStore((state) => state.drafts[draftKey]), postedText);
  const lines = useReplacedLines({ path: anchorPath(anchor), revisionId: anchor.revisionId, firstLine: anchor.firstLine, lastLine: anchor.lastLine });
  const suggest = suggestButtonOf(lines, text, anchor);
  const insertSuggestion = useSuggestionInsert(field, draftKey, text);
  const insert = (): void => {
    if (lines.kind === 'read') insertSuggestion(lines.value);
  };
  return (
    <Tooltip content={suggest.tip}>
      <Button size="small" variant="ghost" icon={<MessageSquareDiff size={14} aria-hidden />} disabled={!suggest.enabled} onClick={insert}>
        Suggest change
      </Button>
    </Tooltip>
  );
}
