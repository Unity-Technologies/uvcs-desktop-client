import { MessageSquareDiff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { withSuggestionAt } from '@shared/reviewSuggestion';
import { placeId } from '@shared/domain/place';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { commentDraftKey } from '../../../components/DetailsHeading';
import type { CommentFieldHandle } from '../../../components/commentEditor/commentFieldProps';
import { useCommentDraftStore } from '../../../components/commentDraftStore';
import { Button } from '../../../ui/Button';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { Tooltip } from '../../../ui/Tooltip';
import { composerText } from '../conversation/composerText';
import { suggestButtonOf } from '../suggestions/suggestButton';
import { useReplacedLines } from '../suggestions/useReplacedLines';
import { CommentComposer } from '../conversation/CommentComposer';
import { addLineComment } from '../conversation/reviewCommentOperations';
import { THREAD_KIND_ICONS } from '../conversation/ThreadKindIcon';
import { threadKindName } from '../conversation/threadBadges';
import { conversationReadAt, conversationReadSince } from '../conversation/useReviewConversation';
import { focusOnRequest, LINE_COMMENT_KINDS, lineCommentLabel, lineCommentWords, type NewLineCommentSpot } from './newLineComment';
import { useNewLineCommentsStore } from './newLineCommentsStore';
import styles from './NewLineCommentCard.module.css';

const KIND_SEGMENTS = LINE_COMMENT_KINDS.map((kind) => {
  const name = threadKindName({ kind });
  const Icon = THREAD_KIND_ICONS[name];
  return {
    value: kind,
    label: (
      <>
        <Icon size={12} aria-hidden />
        {name}
      </>
    ),
  };
});

interface NewLineCommentCardProps {
  spot: NewLineCommentSpot;
  /** Sent and read back: the line's new thread is to show, even while comments are hidden in the code. */
  onSent: () => void;
}

/**
 * A comment being written under a line of a review's diff: what it is (a change request, a question or a comment,
 * which can't change once posted), then the rich editor. Suggest change inserts a suggestion of the line at the caret
 * (docs/features/code-reviews.md "Suggested changes"), from the diff's own read of it, making the comment a change
 * request; opened from the code's "Suggest change on line 42" (`suggestRequest`), it's inserted as the line is read. Sent at once, as every comment is, it stays, sending, until the
 * conversation read again holds it (`conversationReadSince`), so the line never shows nothing in between. Cancel or Esc
 * drop it, asking first once words were written. Focused only when opened (`focusRequest`).
 */
export function NewLineCommentCard({ spot, onSent }: NewLineCommentCardProps) {
  const place = usePlace();
  const setKind = useNewLineCommentsStore((state) => state.setKind);
  const close = useNewLineCommentsStore((state) => state.close);
  const focusTaken = useNewLineCommentsStore((state) => state.focusTaken);
  const focusSeq = useNewLineCommentsStore((state) => (state.focusRequest?.key === spot.key ? state.focusRequest.seq : null));
  const field = useRef<CommentFieldHandle>(null);
  // Opened just now, the field takes the focus as it mounts; opened again while shown, it's focused here.
  const mountedFor = useRef(focusSeq);
  useEffect(() => {
    const focus = focusOnRequest(mountedFor.current, focusSeq);
    if (focus === 'focus') field.current?.focusAtEnd();
    if (focus !== 'none' && focusSeq !== null) focusTaken(focusSeq);
  }, [focusSeq, focusTaken]);
  const { kind } = spot.comment;
  const words = lineCommentWords(kind);

  const draftKey = commentDraftKey(placeId(place), 'reviewLineComment', spot.key);
  const text = composerText(useCommentDraftStore((state) => state.drafts[draftKey]), '');
  const lineText = useReplacedLines({ path: spot.path, revisionId: spot.comment.revisionId, firstLine: spot.comment.line, lastLine: spot.comment.line });
  const suggest = suggestButtonOf(lineText, text);
  // The caret to put back once the text with the suggestion shows: the field takes a new text on its next render.
  const [caretAfterInsert, setCaretAfterInsert] = useState<number | null>(null);
  const insertSuggestion = (): void => {
    if (!suggest.enabled || !Array.isArray(lineText)) return;
    const at = field.current?.selection()?.head ?? text.length;
    const inserted = withSuggestionAt(text, at, lineText);
    useCommentDraftStore.getState().keep(draftKey, { summary: '', description: inserted.text });
    if (kind !== 'changeRequest') setKind(spot.key, 'changeRequest');
    setCaretAfterInsert(inserted.caret);
  };
  useEffect(() => {
    if (caretAfterInsert === null) return;
    if (field.current?.focusAtSelection({ anchor: caretAfterInsert, head: caretAfterInsert }) !== false) setCaretAfterInsert(null);
  });
  const suggestSeq = useNewLineCommentsStore((state) => (state.suggestRequest?.key === spot.key ? state.suggestRequest.seq : null));
  const suggestTaken = useNewLineCommentsStore((state) => state.suggestTaken);
  // Kept apart from the store's request, which a second mount (StrictMode) still sees in its first render's values.
  const suggestedFor = useRef<number | null>(null);
  useEffect(() => {
    if (suggestSeq === null || lineText === 'reading' || suggestedFor.current === suggestSeq) return;
    suggestedFor.current = suggestSeq;
    suggestTaken(suggestSeq);
    insertSuggestion();
  }, [suggestSeq, lineText]);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <SegmentedControl small value={kind} segments={KIND_SEGMENTS} onChange={(picked) => setKind(spot.key, picked)} label="Comment kind" />
        <Tooltip content={suggest.tip}>
          <Button size="small" variant="ghost" className={styles.suggest} icon={<MessageSquareDiff size={14} aria-hidden />} disabled={!suggest.enabled} onClick={insertSuggestion}>
            Suggest change
          </Button>
        </Tooltip>
      </div>
      <div>
        <CommentComposer
          fieldRef={field}
          fieldClassName={styles.field}
          draftKey={draftKey}
          placeholder={words.placeholder}
          label={lineCommentLabel({ side: spot.side, lineNumber: spot.comment.line })}
          submitLabel={words.submit}
          autoFocus={mountedFor.current !== null}
          asksBeforeDiscarding
          onSubmit={async (text) => {
            const sent = await addLineComment(place, spot.reviewId, spot.comment, text);
            if (!sent) return false;
            await conversationReadSince(place, spot.reviewId, conversationReadAt(place, spot.reviewId));
            close(spot.key);
            onSent();
            return true;
          }}
          onCancel={() => close(spot.key)}
        />
      </div>
    </div>
  );
}
