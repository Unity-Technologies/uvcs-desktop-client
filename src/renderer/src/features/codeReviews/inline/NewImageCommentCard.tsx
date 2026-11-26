import { useRef } from 'react';
import { placeId } from '@shared/domain/place';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { commentDraftKey } from '../../../components/DetailsHeading';
import type { CommentFieldHandle } from '../../../components/commentEditor/commentFieldProps';
import { CommentedFileContext } from '../../../components/commentEditor/commentedFileContext';
import { CommentComposer } from '../conversation/CommentComposer';
import { addImageComment } from '../conversation/reviewCommentOperations';
import { imageSpotWords } from '../conversation/threadBadges';
import { conversationReadAt, conversationReadSince } from '../conversation/useReviewConversation';
import { CommentKindSwitch } from './CommentKindSwitch';
import { lineCommentWords } from './newLineComment';
import type { NewImageCommentSpot } from './newSpotComment';
import { useNewImageCommentsStore } from './newImageCommentsStore';
import styles from './NewLineCommentCard.module.css';

interface NewImageCommentCardProps {
  spot: NewImageCommentSpot;
  /** Sent and read back: its card closes, the new thread's pin standing where it was written. */
  onSent: () => void;
}

/**
 * A comment being written on a point or an area of a review's image, beside its pin: what it is, then the rich editor,
 * as one under a line of code is (`NewLineCommentCard`), with no Suggest change, an image having no lines to suggest.
 * Sent, it stays until the conversation read again holds it, so the pin never shows nothing in between.
 */
export function NewImageCommentCard({ spot, onSent }: NewImageCommentCardProps) {
  const place = usePlace();
  const setKind = useNewImageCommentsStore((state) => state.setKind);
  const close = useNewImageCommentsStore((state) => state.close);
  const { kind } = spot.comment;
  const field = useRef<CommentFieldHandle>(null);
  const words = lineCommentWords(kind);
  return (
    <CommentedFileContext.Provider value={spot.path}>
      <div className={styles.card}>
        <div className={styles.header}>
          <CommentKindSwitch kind={kind} onChange={(picked) => setKind(spot.key, picked)} field={field} />
        </div>
        <CommentComposer
          fieldRef={field}
          fieldClassName={styles.field}
          draftKey={commentDraftKey(placeId(place), 'reviewLineComment', spot.key)}
          placeholder={words.placeholder}
          label={`Comment on this ${imageSpotWords(spot.comment.spot)}`}
          submitLabel={words.submit}
          autoFocus
          asksBeforeDiscarding
          onSubmit={async (text) => {
            const sent = await addImageComment(place, spot.reviewId, spot.comment, text);
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
