import { useCallback, type ReactNode } from 'react';
import { hotkey } from '../../lib/shortcutRegistry';
import { Kbd } from '../../ui/Kbd';
import { AnnotationCard } from './AnnotationCard';
import { BLOCK_LABEL_ATTRIBUTE } from './BlockLabel';
import { otherBlocksOfChangeset, type AnnotationBlock } from './annotationBlocks';
import type { BlockLinks } from './blockLinks';
import type { BlockCardState } from './useBlockCard';
import { otherBlocksHint } from './otherBlocksHint';

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
      hint={otherBlocksHintOf(otherBlocksOfChangeset(blocks, block), block === picked)}
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
// A function, not a component: the card shows its hint's line only when there is one.
function otherBlocksHintOf(others: number, highlighted: boolean): ReactNode {
  const hint = otherBlocksHint(others, highlighted, hotkey('annotateNextSameChangeset'));
  if (hint.kind === 'none') return undefined;
  if (hint.kind === 'click' || !hint.nextKey) return hint.text;
  return (
    <>
      {hint.text} · <Kbd keys={hint.nextKey} /> goes to the next
    </>
  );
}
