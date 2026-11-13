import { MessageSquareDiff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { placeId } from '@shared/domain/place';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { commentDraftKey } from '../../../components/DetailsHeading';
import type { CommentFieldHandle } from '../../../components/commentEditor/commentFieldProps';
import { useCommentDraftStore } from '../../../components/commentDraftStore';
import { CommentedFileContext } from '../../../components/commentEditor/commentedFileContext';
import { Button } from '../../../ui/Button';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { Tooltip } from '../../../ui/Tooltip';
import { composerText } from '../conversation/composerText';
import { refusalShown, suggestButtonOf, suggestRequestOutcome, withSuggestionInserted, type SuggestRefusal } from '../suggestions/suggestButton';
import { commentedLines } from '../suggestions/suggestedChange';
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
 * request (`withSuggestionInserted`); opened from the code's "Suggest change on line 42" (`suggestRequest`), it's
 * inserted as the line is read. Sent at once, as every comment is, it stays, sending, until the conversation read again
 * holds it (`conversationReadSince`), so the line never shows nothing in between. Cancel or Esc drop it, asking first
 * once words were written. Focused only when opened (`focusRequest`).
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
  // The lines the comment is on, which Suggest change fills the fence with: one today, a range once comments take them.
  const lineText = useReplacedLines({ path: spot.path, revisionId: spot.comment.revisionId, ...commentedLines(spot.comment) });
  const suggest = suggestButtonOf(lineText, text);
  // The caret to put back once the text with the suggestion shows: the field takes a new text on its next render.
  const [caretAfterInsert, setCaretAfterInsert] = useState<number | null>(null);
  const insertSuggestion = (lines: readonly string[]): void => {
    const at = field.current?.selection()?.head ?? text.length;
    const inserted = withSuggestionInserted(text, at, lines);
    useCommentDraftStore.getState().keep(draftKey, { summary: '', description: inserted.text });
    setKind(spot.key, inserted.kind);
    setCaretAfterInsert(inserted.caret);
  };
  const suggestAtCaret = (): void => {
    const outcome = suggestRequestOutcome(lineText, text);
    if (outcome.kind === 'insert') insertSuggestion(outcome.lines);
  };
  useEffect(() => {
    if (caretAfterInsert === null) return;
    if (field.current?.focusAtSelection({ anchor: caretAfterInsert, head: caretAfterInsert }) !== false) setCaretAfterInsert(null);
  });
  const suggestSeq = useNewLineCommentsStore((state) => (state.suggestRequest?.key === spot.key ? state.suggestRequest.seq : null));
  const suggestTaken = useNewLineCommentsStore((state) => state.suggestTaken);
  // Kept apart from the store's request, which a second mount (StrictMode) still sees in its first render's values.
  const suggestedFor = useRef<number | null>(null);
  // Why the menu's request couldn't be met, said in the card rather than leaving it without a suggestion silently.
  const [refusal, setRefusal] = useState<SuggestRefusal | null>(null);
  const refusedSuggestion = refusalShown(refusal, text);
  useEffect(() => {
    if (suggestSeq === null || suggestedFor.current === suggestSeq) return;
    const outcome = suggestRequestOutcome(lineText, text);
    if (outcome.kind === 'wait') return;
    suggestedFor.current = suggestSeq;
    suggestTaken(suggestSeq);
    if (outcome.kind === 'insert') insertSuggestion(outcome.lines);
    else setRefusal({ reason: outcome.reason, text });
  }, [suggestSeq, lineText]);

  return (
    <CommentedFileContext.Provider value={spot.path}>
      <div className={styles.card}>
        <div className={styles.header}>
          <SegmentedControl small value={kind} segments={KIND_SEGMENTS} onChange={(picked) => setKind(spot.key, picked)} label="Comment kind" />
          <Tooltip content={suggest.tip}>
            <Button size="small" variant="ghost" className={styles.suggest} icon={<MessageSquareDiff size={14} aria-hidden />} disabled={!suggest.enabled} onClick={suggestAtCaret}>
              Suggest change
            </Button>
          </Tooltip>
        </div>
        {refusedSuggestion && (
          <p className={styles.notice} role="status">
            No suggestion added: {refusedSuggestion}
          </p>
        )}
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
    </CommentedFileContext.Provider>
  );
}
