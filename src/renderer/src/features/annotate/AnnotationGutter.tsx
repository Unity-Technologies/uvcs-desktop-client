import { GalleryHorizontalEnd } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { BlockLinks } from './AnnotatedCode';
import { formatRelativeDate } from '../../lib/formatDate';
import { firstLine } from '../../lib/text';
import { Avatar } from '../../ui/Avatar';
import type { AnnotateColumns } from './annotateOptionsStore';
import type { AnnotationBlock } from './annotationBlocks';
import type { RowRange } from './visibleRows';
import styles from './AnnotationGutter.module.css';

/** The attribute naming a block's label, which its card is anchored to. */
export const BLOCK_LABEL_ATTRIBUTE = 'data-block-label';

interface AnnotationGutterProps {
  blocks: readonly AnnotationBlock[];
  /** The blocks in view, as block indexes: only they are rendered, the rest keep their room. */
  shown: RowRange;
  columns: AnnotateColumns;
  lineHeight: number;
  /** The changeset whose lines stand out: the one hovered, or the keyboard's. */
  highlighted: number | null;
  /** The keyboard's block. */
  active: number;
  onHover: (block: number | null) => void;
  /** The pointer is on (a block) or off (null) a block's label, which opens its card. */
  onHoverLabel: (block: number | null) => void;
  onClick: (block: number) => void;
  /** "Annotate before this change" of a block, if the history has a revision before it. */
  walkBack?: BlockLinks['walkBack'];
}

/**
 * One band per block, drawn once for all its lines: the age strip down its left edge and, on its first line, who
 * changed it, the comment and when. The label sticks to the top while the rest of a tall block is in view, so every
 * line on screen tells whose it is.
 */
export function AnnotationGutter({
  blocks,
  shown,
  columns,
  lineHeight,
  highlighted,
  active,
  onHover,
  onHoverLabel,
  onClick,
  walkBack,
}: AnnotationGutterProps) {
  const showsDetails = columns.author || columns.changeset || columns.date;
  const blockOf = (event: MouseEvent): number | null => {
    const element = (event.target as Element).closest<HTMLElement>('[data-block]');
    return element ? Number(element.dataset.block) : null;
  };

  return (
    <div
      className={styles.gutter}
      data-compact={!showsDetails}
      aria-hidden="true"
      onMouseOver={(event) => onHover(blockOf(event))}
      onMouseLeave={() => onHover(null)}
      onClick={(event) => {
        const block = blockOf(event);
        if (block !== null) onClick(block);
      }}
    >
      <div style={{ height: (blocks[shown.first]?.start ?? 0) * lineHeight }} />
      {blocks.slice(shown.first, shown.end).map((block, offset) => {
        const index = shown.first + offset;
        const { changeset } = block;
        const before = showsDetails ? walkBack?.revisionBefore(changeset.changesetId) : undefined;
        return (
          <div
            key={block.start}
            className={styles.block}
            data-block={index}
            data-age={block.age}
            data-highlighted={changeset.changesetId === highlighted}
            data-active={index === active}
            style={{ height: (block.end - block.start) * lineHeight }}
          >
            {showsDetails && (
              <div
                className={styles.label}
                style={{ height: lineHeight }}
                {...{ [BLOCK_LABEL_ATTRIBUTE]: index }}
                // The card tells all of it: no tooltip for the cut comment.
                data-tip=""
                onMouseEnter={() => onHoverLabel(index)}
                onMouseLeave={() => onHoverLabel(null)}
              >
                {/* The face says who, the card names them: a name on every block crowds out the comment. */}
                {columns.author && <Avatar user={changeset.owner} size={16} tip={null} />}
                <span className={styles.comment}>{firstLine(changeset.comment) || 'No comment'}</span>
                {columns.changeset && <span className={styles.changeset}>{changeset.changesetId}</span>}
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
            )}
          </div>
        );
      })}
      <div style={{ height: (blocks.length > 0 ? blocks.at(-1)!.end - (blocks[shown.end - 1]?.end ?? 0) : 0) * lineHeight }} />
    </div>
  );
}
