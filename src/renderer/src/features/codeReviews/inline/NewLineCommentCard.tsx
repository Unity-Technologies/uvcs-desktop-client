import { useEffect, useRef } from 'react';
import { placeId } from '@shared/domain/place';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { commentDraftKey } from '../../../components/DetailsHeading';
import type { CommentFieldHandle } from '../../../components/commentEditor/commentFieldProps';
import { SegmentedControl } from '../../../ui/SegmentedControl';
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
        <Icon size={13} aria-hidden />
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
 * which can't change once posted), then the rich editor. Sent at once, as every comment is, it stays, sending, until the
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

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <SegmentedControl value={kind} segments={KIND_SEGMENTS} onChange={(picked) => setKind(spot.key, picked)} label="Comment kind" />
      </div>
      <div className={styles.body}>
        <CommentComposer
          fieldRef={field}
          draftKey={commentDraftKey(placeId(place), 'reviewLineComment', spot.key)}
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
