import { useCallback, type ReactNode } from 'react';
import { hotkey } from '../../lib/shortcutRegistry';
import { pluralize } from '../../lib/text';
import { Kbd } from '../../ui/Kbd';
import { AnnotationCard } from './AnnotationCard';
import { BLOCK_LABEL_ATTRIBUTE } from './BlockLabel';
import { otherBlocksOfChangeset, type AnnotationBlock } from './annotationBlocks';
import type { BlockLinks } from './blockLinks';
import type { BlockCardState } from './useBlockCard';

interface BlockCardProps {
  blocks: readonly AnnotationBlock[];
  cardState: BlockCardState;
  /** The block picked (-1 for none): the card says whether its changeset's other blocks are highlighted. */
  picked: number;
  /** The annotation's scrolling element: it holds the labels the card opens beside, and takes the focus back. */
  scroller: HTMLElement | null;
  links: BlockLinks;
}

/** The card of the block `cardState` names, beside its label, its actions closing it as they lead away. */
export function BlockCard({ blocks, cardState, picked, scroller, links }: BlockCardProps) {
  const { block, card } = cardState;
  const changeset = blocks[block]?.changeset;
  const anchor = useCallback((): Element | null => scroller?.querySelector(`[${BLOCK_LABEL_ATTRIBUTE}="${block}"]`) ?? null, [scroller, block]);
  // Each action leads away from the block: the card closes first.
  const closingCard =
    <Value,>(action: (value: Value) => void) =>
    (value: Value): void => {
      card.close();
      action(value);
    };

  return (
    <AnnotationCard
      changeset={changeset}
      anchor={anchor}
      open={card.open}
      pinned={card.pinned}
      onOpenChange={card.onOpenChange}
      hoverProps={card.hoverProps}
      returnFocusTo={scroller}
      hint={otherBlocksHint(otherBlocksOfChangeset(blocks, block), block === picked)}
      actions={{
        openChangeset: links.openChangeset && closingCard(links.openChangeset),
        revisionBefore: changeset && links.walkBack?.revisionBefore(changeset.changesetId),
        annotateBefore: closingCard((revision) => links.walkBack?.annotateBefore(revision)),
        showInHistory: closingCard(links.showInHistory),
      }}
    />
  );
}

/** How to find the changeset's other blocks: they're highlighted while the card's block is picked. */
function otherBlocksHint(others: number, highlighted: boolean): ReactNode {
  if (others === 0) return undefined;
  if (!highlighted) return `Click the block to highlight its ${pluralize(others, 'other block')}`;
  return (
    <>
      {pluralize(others, 'other block')} highlighted · <Kbd keys={hotkey('annotateNextSameChangeset')} /> goes to the next
    </>
  );
}
