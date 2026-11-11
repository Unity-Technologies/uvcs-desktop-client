import type { LineCommentKind } from '@shared/domain/reviewConversation';
import { placeId } from '@shared/domain/place';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { commentDraftKey } from '../../../components/DetailsHeading';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { CommentComposer } from '../conversation/CommentComposer';
import { addLineComment } from '../conversation/reviewCommentOperations';
import { THREAD_KIND_ICONS } from '../conversation/ThreadKindIcon';
import { threadKindName } from '../conversation/threadBadges';
import { lineCommentWords, type NewLineCommentSpot } from './newLineComment';
import { useNewLineCommentsStore } from './newLineCommentsStore';
import styles from './NewLineCommentCard.module.css';

const KINDS: readonly LineCommentKind[] = ['changeRequest', 'question', 'comment'];

const KIND_SEGMENTS = KINDS.map((kind) => {
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
  /** Sent: the line's new thread is to show, even while comments are hidden in the code. */
  onSent: () => void;
}

/**
 * A comment being written under a line of a review's diff: what it is (a change request, a question or a comment,
 * which can't change once posted), then the rich editor. Sent at once, as every comment is; Cancel or Esc drop it,
 * asking first once words were written.
 */
export function NewLineCommentCard({ spot, onSent }: NewLineCommentCardProps) {
  const place = usePlace();
  const setKind = useNewLineCommentsStore((state) => state.setKind);
  const close = useNewLineCommentsStore((state) => state.close);
  const { kind } = spot.comment;
  const words = lineCommentWords(kind);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <SegmentedControl value={kind} segments={KIND_SEGMENTS} onChange={(picked) => setKind(spot.key, picked)} label="Comment kind" />
      </div>
      <div className={styles.body}>
        <CommentComposer
          draftKey={commentDraftKey(placeId(place), 'reviewLineComment', spot.key)}
          placeholder={words.placeholder}
          label={`Comment on line ${spot.comment.line}`}
          submitLabel={words.submit}
          autoFocus
          asksBeforeDiscarding
          onSubmit={async (text) => {
            const sent = await addLineComment(place, spot.reviewId, spot.comment, text);
            if (sent) {
              close(spot.key);
              onSent();
            }
            return sent;
          }}
          onCancel={() => close(spot.key)}
        />
      </div>
    </div>
  );
}
