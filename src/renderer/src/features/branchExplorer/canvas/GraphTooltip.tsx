import { displayName } from '../../../lib/userName';
import { formatRelativeDate } from '../../../lib/formatDate';
import type { GraphLayout } from '../model/layoutGraph';
import { MERGE_LINK_NAMES } from '../model/mergeLinkNames';
import { useLayoutEffect, useRef } from 'react';
import { captionCardPosition, captionMetrics, cardMaxWidth, keepInside } from './captionCard';
import { summaryOf } from './fitText';
import type { GraphPalette } from './graphPalette';
import type { GraphTarget } from './graphTargets';
import styles from './GraphTooltip.module.css';

/**
 * Where a tooltip opens: over a changeset's caption (the card's first line lays exactly on it, so the cut comment
 * appears to complete itself in place), just below a branch header (the pill unfolding), or next to the pointer.
 */
export type TooltipAnchor = { kind: 'caption'; x: number; middle: number } | { kind: 'below'; x: number; top: number };

interface GraphTooltipProps {
  target: GraphTarget;
  layout: GraphLayout;
  palette: GraphPalette;
  /** The pointer, for tooltips without an anchor. */
  x: number;
  y: number;
  anchor: TooltipAnchor | null;
  containerWidth: number;
}

/** Near the right edge a pointer tooltip opens to the left of the pointer, so it is never squeezed. */
const POINTER_TOOLTIP_ROOM = 360;

export function GraphTooltip({ target, layout, palette, x, y, anchor, containerWidth }: GraphTooltipProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Once the card knows its width, it moves just enough to stay inside the canvas, before it is painted.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (card) card.style.left = `${keepInside(card.offsetLeft, card.offsetWidth, containerWidth)}px`;
  });

  if (anchor?.kind === 'caption' && target.kind === 'changeset') {
    const changeset = layout.nodes.get(target.id)?.changeset;
    if (!changeset) return null;
    const maxWidth = cardMaxWidth(window.innerWidth);
    const position = captionCardPosition(anchor, captionMetrics(palette.fonts.caption, palette.captionFontSize), palette.captionFontSize);
    const summary = summaryOf(changeset.comment);
    const body = changeset.comment.slice(changeset.comment.indexOf(summary) + summary.length).trim();
    return (
      <div ref={cardRef} className={styles.card} style={{ ...position, maxWidth }}>
        {/* Same font, size and color as the caption it lays over: a heavier or brighter line would read as the text jumping. */}
        <div className={styles.subject} style={{ font: palette.fonts.caption }}>
          {summary}
        </div>
        <div className={styles.meta}>
          Changeset {changeset.id} · {displayName(changeset.owner)} · {formatRelativeDate(changeset.date)}
        </div>
        {body && <div className={styles.cardBody}>{body}</div>}
      </div>
    );
  }

  const content = tooltipContent(target, layout);
  if (!content) return null;
  if (anchor?.kind === 'below') {
    return (
      <div ref={cardRef} className={styles.card} style={{ left: anchor.x, top: anchor.top, maxWidth: cardMaxWidth(window.innerWidth) }}>
        <div className={styles.title}>{content.title}</div>
        {content.body && <div className={styles.cardBody}>{content.body}</div>}
        {content.meta && <div className={styles.meta}>{content.meta}</div>}
      </div>
    );
  }

  const flip = x > containerWidth - POINTER_TOOLTIP_ROOM;
  return (
    <div className={styles.tooltip} data-flip={flip} style={{ left: flip ? x - 14 : x + 14, top: y + 14 }}>
      <div className={styles.title}>{content.title}</div>
      {content.body && <div className={styles.body}>{content.body}</div>}
      {content.meta && <div className={styles.meta}>{content.meta}</div>}
    </div>
  );
}

function tooltipContent(target: GraphTarget, layout: GraphLayout): { title: string; body?: string; meta?: string } | null {
  switch (target.kind) {
    case 'changeset': {
      const changeset = layout.nodes.get(target.id)?.changeset;
      if (!changeset) return null;
      return {
        title: `Changeset ${changeset.id} · ${changeset.branch}`,
        body: changeset.comment || 'No comment',
        meta: `${displayName(changeset.owner)} · ${formatRelativeDate(changeset.date)}`,
      };
    }
    case 'collapsed': {
      const run = target.node.collapsed!;
      return {
        title: `${run.length} changesets on ${target.node.changeset.branch}`,
        body: `Changesets ${run[0]!.id} to ${run.at(-1)!.id}, hidden by “Only relevant changesets”.`,
        meta: 'Click to show them',
      };
    }
    case 'branch':
      return {
        title: target.lane.branch.name,
        body: target.lane.branch.comment || undefined,
        meta: `Created by ${displayName(target.lane.branch.owner)} · ${formatRelativeDate(target.lane.branch.date)}`,
      };
    case 'label':
      return {
        title: `Label ${target.label.name}`,
        body: target.label.comment || undefined,
        meta: `Changeset ${target.label.changeset} · ${displayName(target.label.owner)}`,
      };
    case 'codeReview':
      return {
        title: target.review.title,
        body: `Code review ${target.review.id} · ${target.review.status}`,
        meta: 'Click to open the review',
      };
    case 'mergeLink':
      return {
        title: MERGE_LINK_NAMES[target.link.type],
        meta: `From changeset ${target.link.sourceChangeset} to ${target.link.destinationChangeset}`,
      };
  }
}
