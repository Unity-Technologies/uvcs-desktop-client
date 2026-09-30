import { GalleryHorizontalEnd } from 'lucide-react';
import type { MouseEvent } from 'react';
import { formatRelativeDate } from '../../lib/formatDate';
import { firstLine } from '../../lib/text';
import { Avatar } from '../../ui/Avatar';
import type { AnnotateColumns } from './annotateOptionsStore';
import type { AnnotationBlock } from './annotationBlocks';
import type { BlockLinks } from './blockLinks';
import styles from './AnnotationGutter.module.css';

/** The attribute naming a block's label, which its card is anchored to. */
export const BLOCK_LABEL_ATTRIBUTE = 'data-block-label';

interface BlockLabelProps {
  block: AnnotationBlock;
  /** The block's index, which its label is named by. */
  index: number;
  columns: AnnotateColumns;
  lineHeight: number;
  /** The pointer is on (the block) or off (null) the avatar or comment, which open its card. */
  onHoverLabel: (block: number | null) => void;
  /** A click on the avatar or comment: picks the block and pins its card. */
  onPinCard: (block: number) => void;
  /** A click on the changeset number: the block's revision. */
  onShowRevision: (block: number) => void;
  /** What the changeset number leads to, for its tooltip. */
  revisionTip: string;
  /** "Annotate before this change", if the history has a revision before it. */
  walkBack?: BlockLinks['walkBack'];
}

/** A block's first line in the gutter: who changed it (avatar), the comment, the changeset, when, and "Annotate before". */
export function BlockLabel({ block, index, columns, lineHeight, onHoverLabel, onPinCard, onShowRevision, revisionTip, walkBack }: BlockLabelProps) {
  const { changeset } = block;
  const before = walkBack?.revisionBefore(changeset.changesetId);
  const cardTrigger = {
    onMouseEnter: () => onHoverLabel(index),
    onMouseLeave: () => onHoverLabel(null),
    onClick: (event: MouseEvent) => {
      event.stopPropagation();
      onPinCard(index);
    },
  };

  return (
    <div
      className={styles.label}
      style={{ height: lineHeight }}
      {...{ [BLOCK_LABEL_ATTRIBUTE]: index }}
      // The card tells all of it: no tooltip for the cut comment.
      data-tip=""
    >
      {/* The face says who, the card names them: a name on every block crowds out the comment. */}
      {columns.author && (
        <span className={styles.avatar} {...cardTrigger}>
          <Avatar user={changeset.owner} size={16} tip={null} />
        </span>
      )}
      {/* Only the text opens the card, not the room after it, so moving down the gutter doesn't pop cards. */}
      <span className={styles.comment}>
        <span {...cardTrigger}>{firstLine(changeset.comment) || 'No comment'}</span>
      </span>
      {/* The one way to the revision: the rest of the cell is for reading, not a target that jumps away. */}
      {columns.changeset && (
        <button
          className={styles.changeset}
          data-tip={revisionTip}
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            onShowRevision(index);
          }}
        >
          {changeset.changesetId}
        </button>
      )}
      {columns.date && <span className={styles.date}>{formatRelativeDate(changeset.date)}</span>}
      {/* Always takes its slot, so the dates stay aligned down the gutter whether or not there is an earlier revision. */}
      {before ? (
        <button
          className={styles.before}
          aria-label="Annotate before this change"
          data-tip={`Annotate before this change\nThe file as of cs:${before.changesetId}`}
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            walkBack?.annotateBefore(before);
          }}
        >
          <GalleryHorizontalEnd size={13} />
        </button>
      ) : (
        <span className={styles.before} />
      )}
    </div>
  );
}
