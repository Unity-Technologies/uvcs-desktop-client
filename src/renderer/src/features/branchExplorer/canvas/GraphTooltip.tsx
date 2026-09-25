import { displayName } from '../../../lib/userName';
import { formatRelativeDate } from '../../../lib/formatDate';
import type { GraphLayout } from '../model/layoutGraph';
import { MERGE_LINK_NAMES } from '../model/mergeLinkNames';
import { useLayoutEffect, useRef } from 'react';
import { captionCardCorner, captionCardMaxWidth, cardMaxWidth, keepInside } from './captionCard';
import { summaryOf } from './fitText';
import type { GraphPalette } from './graphPalette';
import type { GraphTarget } from './graphTargets';
import styles from './GraphTooltip.module.css';

/**
 * Where a tooltip opens: over a changeset's caption (the card's first line lays exactly on it, in the caption's
 * font and color, so the cut comment appears to complete itself in place), just below a branch header whose text
 * was cut (the pill unfolding), or next to the pointer. `x` and `baseline` are the caption's first glyph.
 */
export type TooltipAnchor = { kind: 'caption'; x: number; baseline: number; color: string } | { kind: 'below'; x: number; top: number };

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
/** Set after the font shorthand, which resets it. */
const SUBJECT_LINE_HEIGHT = 1.45;

/** Marks the cards the pointer can move into to select and copy their text: the canvas leaves them alone. */
export const HOVER_CARD_ATTRIBUTE = 'data-hover-card';

export function GraphTooltip({ target, layout, palette, x, y, anchor, containerWidth }: GraphTooltipProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const textOriginRef = useRef<HTMLSpanElement>(null);
  // Before it is painted, the card over a caption measures where its text landed and moves it onto the caption's
  // glyphs (whatever the font's metrics and line box do); then any card moves just enough to stay inside the canvas.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const origin = textOriginRef.current;
    if (origin && anchor?.kind === 'caption') {
      const box = card.getBoundingClientRect();
      const text = origin.getBoundingClientRect();
      const corner = captionCardCorner(anchor, { x: text.left - box.left, y: text.bottom - box.top });
      card.style.left = `${corner.left}px`;
      card.style.top = `${corner.top}px`;
    }
    card.style.left = `${keepInside(card.offsetLeft, card.offsetWidth, containerWidth)}px`;
  });

  if (anchor?.kind === 'caption' && target.kind === 'changeset') {
    const changeset = layout.nodes.get(target.id)?.changeset;
    if (!changeset) return null;
    const maxWidth = captionCardMaxWidth(anchor.x, containerWidth, window.innerWidth);
    const summary = summaryOf(changeset.comment);
    const body = changeset.comment.slice(changeset.comment.indexOf(summary) + summary.length).trim();
    return (
      <div ref={cardRef} className={styles.card} style={{ left: anchor.x, top: anchor.baseline, maxWidth }} {...{ [HOVER_CARD_ATTRIBUTE]: true }}>
        {/* Same font, size and color as the caption it lays over: a heavier or brighter line would read as the text jumping. */}
        <div className={styles.subject} style={{ font: palette.fonts.caption, lineHeight: SUBJECT_LINE_HEIGHT, color: anchor.color }}>
          {/* An empty inline block sits on the baseline, where the caption's first glyph starts. */}
          <span ref={textOriginRef} className={styles.textOrigin} />
          {summary}
        </div>
        {/* Wrapped in a card narrowed by the edge, the line breaks between its parts, never inside one. */}
        <div className={styles.meta}>
          <span className={styles.metaPart}>Changeset {changeset.id}</span> · <span className={styles.metaPart}>{displayName(changeset.owner)}</span> ·{' '}
          <span className={styles.metaPart}>{formatRelativeDate(changeset.date)}</span>
        </div>
        {body && <div className={styles.cardBody}>{body}</div>}
      </div>
    );
  }

  const content = tooltipContent(target, layout);
  if (!content) return null;
  if (anchor?.kind === 'below') {
    return (
      <div
        ref={cardRef}
        className={styles.card}
        style={{ left: anchor.x, top: anchor.top, maxWidth: cardMaxWidth(window.innerWidth) }}
        {...{ [HOVER_CARD_ATTRIBUTE]: true }}
      >
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
