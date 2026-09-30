import type { MouseEvent } from 'react';
import type { AnnotateColumns } from './annotateOptionsStore';
import type { AnnotationBlock } from './annotationBlocks';
import { roomAroundShown } from './annotationLayout';
import { BlockLabel } from './BlockLabel';
import type { BlockLinks } from './blockLinks';
import type { RowRange } from './visibleRows';
import styles from './AnnotationGutter.module.css';

interface AnnotationGutterProps {
  blocks: readonly AnnotationBlock[];
  /** The blocks in view, as block indexes: only they are rendered, the rest keep their room. */
  shown: RowRange;
  columns: AnnotateColumns;
  lineHeight: number;
  /** The block picked, by a click or the keyboard: its changeset stands out. */
  picked: number;
  /** The pointer is on (a block) or off (null) a block's avatar or comment, which opens its card. */
  onHoverLabel: (block: number | null) => void;
  /** A click anywhere else in a block's cell: picks it, or lets go of it if picked. */
  onPick: (block: number) => void;
  /** A click on the avatar or comment: picks the block and pins its card. */
  onPinCard: (block: number) => void;
  /** A click on the changeset number: the block's revision. */
  onShowRevision: (block: number) => void;
  /** What the changeset number leads to, for its tooltip. */
  revisionTip: string;
  /** "Annotate before this change" of a block, if the history has a revision before it. */
  walkBack?: BlockLinks['walkBack'];
}

/**
 * One band per block, drawn once for all its lines: the age strip down its left edge and, on its first line, its label
 * (`BlockLabel`). The label sticks to the top while the rest of a tall block is in view, so every line on screen tells
 * whose it is.
 */
export function AnnotationGutter({ blocks, shown, columns, lineHeight, picked, onPick, ...labelProps }: AnnotationGutterProps) {
  const showsLabels = columns.author || columns.changeset || columns.date;
  const room = roomAroundShown(blocks, shown);
  const pickClicked = (event: MouseEvent): void => {
    const element = (event.target as Element).closest<HTMLElement>('[data-block]');
    if (element) onPick(Number(element.dataset.block));
  };

  return (
    <div className={styles.gutter} data-compact={!showsLabels} aria-hidden="true" onClick={pickClicked}>
      <div style={{ height: room.above * lineHeight }} />
      {blocks.slice(shown.first, shown.end).map((block, offset) => {
        const index = shown.first + offset;
        return (
          <div
            key={block.start}
            className={styles.block}
            data-block={index}
            data-age={block.age}
            data-active={index === picked}
            style={{ height: (block.end - block.start) * lineHeight }}
          >
            {showsLabels && <BlockLabel block={block} index={index} columns={columns} lineHeight={lineHeight} {...labelProps} />}
          </div>
        );
      })}
      <div style={{ height: room.below * lineHeight }} />
    </div>
  );
}
