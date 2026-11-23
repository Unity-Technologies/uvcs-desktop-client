import { Box, Dot } from 'lucide-react';
import { placeId } from '@shared/domain/place';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { commentDraftKey } from '../../../components/DetailsHeading';
import { CommentedFileContext } from '../../../components/commentEditor/commentedFileContext';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { CommentComposer } from '../conversation/CommentComposer';
import { addModelComment } from '../conversation/reviewCommentOperations';
import { modelSpotWords } from '../conversation/threadBadges';
import { conversationReadAt, conversationReadSince } from '../conversation/useReviewConversation';
import { CommentKindSwitch } from './CommentKindSwitch';
import { modelCommentAboutOf, spotAbout, type ModelCommentAbout } from './modelCommentAbout';
import { lineCommentWords } from './newLineComment';
import type { NewModelCommentSpot } from './newSpotComment';
import { useNewModelCommentsStore } from './newModelCommentsStore';
import styles from './NewLineCommentCard.module.css';

interface NewModelCommentCardProps {
  spot: NewModelCommentSpot;
  /** Sent and read back: its card closes, the new thread's pin standing where it was written. */
  onSent: () => void;
}

/**
 * A comment being written on a 3D model of a review, beside its pin: what it is, what it's about (the point, or the
 * whole part it's on, named, which lights up), then the rich editor, as one under a line of code is
 * (`NewLineCommentCard`), with no Suggest change, a model having no lines to suggest. Sent, it stays until the
 * conversation read again holds it, so the pin never shows nothing in between.
 */
export function NewModelCommentCard({ spot, onSent }: NewModelCommentCardProps) {
  const place = usePlace();
  const setKind = useNewModelCommentsStore((state) => state.setKind);
  const moveTo = useNewModelCommentsStore((state) => state.moveTo);
  const close = useNewModelCommentsStore((state) => state.close);
  const { kind } = spot.comment;
  const words = lineCommentWords(kind);
  const about = modelCommentAboutOf(spot.comment.spot);
  return (
    <CommentedFileContext.Provider value={spot.path}>
      <div className={styles.card}>
        <div className={styles.header}>
          <CommentKindSwitch kind={kind} onChange={(picked) => setKind(spot.key, picked)} />
        </div>
        {about && (
          <div className={styles.about}>
            <span className={styles.aboutLabel} aria-hidden>
              Comment on
            </span>
            <SegmentedControl<ModelCommentAbout>
              small
              value={about.about}
              label="What the comment is on"
              segments={[
                { value: 'point', label: <><Dot size={12} aria-hidden />Point</>, title: 'This point of the surface' },
                { value: 'part', label: <><Box size={12} aria-hidden /><span className={styles.partName}>{about.partName}</span></>, title: `The whole part: ${about.partName}` },
              ]}
              onChange={(picked) => moveTo(spot.key, spotAbout(spot.comment.spot, picked))}
            />
          </div>
        )}
        <CommentComposer
          fieldClassName={styles.field}
          draftKey={commentDraftKey(placeId(place), 'reviewLineComment', spot.key)}
          placeholder={words.placeholder}
          label={`Comment on this ${modelSpotWords(spot.comment.spot)}`}
          submitLabel={words.submit}
          autoFocus
          asksBeforeDiscarding
          onSubmit={async (text) => {
            const sent = await addModelComment(place, spot.reviewId, spot.comment, text);
            if (!sent) return false;
            await conversationReadSince(place, spot.reviewId, conversationReadAt(place, spot.reviewId));
            close(spot.key);
            onSent();
            return true;
          }}
          onCancel={() => close(spot.key)}
        />
      </div>
    </CommentedFileContext.Provider>
  );
}
