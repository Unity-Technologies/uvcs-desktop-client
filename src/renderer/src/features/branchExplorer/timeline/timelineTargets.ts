import type { ActivityCurve } from './activityCurve';
import { columnAtStrip, stripXOfColumn, type TimelineAxis } from './timelineAxis';
import { frameCenteredAt, frameShape, type TimelineFrame } from './timelineFrame';
import { BASELINE, HIT_TICK_HEIGHT, HIT_TICK_TOP, MERGED_LABEL_TICK_HEIGHT, MERGED_LABEL_TICK_TOP, PLOT_HEIGHT, PLOT_TOP } from './timelineGeometry';
import type { HitTick, HomeMark, LabelTick, TimelineGap } from './timelineMarks';

export interface Point {
  x: number;
  y: number;
}

/** What the pointer is on in the Timeline. */
export type TimelineTarget =
  | { kind: 'frameEdge'; edge: 'left' | 'right' }
  | { kind: 'frame' }
  /** The house: the workspace, or its pending changes when it has some. */
  | { kind: 'home' }
  | { kind: 'labels'; tick: LabelTick }
  | { kind: 'gap'; gap: TimelineGap }
  | { kind: 'hits'; tick: HitTick }
  /** Anywhere else: the moment under the pointer. */
  | { kind: 'moment' };

/** Where the things the pointer can land on are drawn, in strip px. */
export interface TimelineSpots {
  frame: TimelineFrame;
  labels: readonly LabelTick[];
  gaps: readonly TimelineGap[];
  hits: readonly HitTick[];
  /** The house's middle. */
  home: Point | null;
}

/** The house's badge stands this far above the curve (its middle), as the graph pins it to its changeset's shoulder. */
const HOUSE_LIFT = 12;
/** Where the house sits when the workspace is older than everything loaded: in from the left edge, a "‹" before it. */
export const PINNED_HOUSE_X = 22;

/** The top of the curve at a point of the strip. */
export function curveTopAt(curve: ActivityCurve, x: number): number {
  const pixel = Math.min(curve.total.length - 1, Math.max(0, Math.floor(x)));
  return BASELINE - (curve.total[pixel] ?? 0) * PLOT_HEIGHT;
}

/** The house's badge: an 18 px disc, as the graph's home badge at full size (`drawHomeBadge`). */
export const HOUSE_RADIUS = 9;
/** The house's highest middle: its disc stays under the search hits' ticks along the top edge. */
const HOUSE_TOP = HIT_TICK_TOP + HIT_TICK_HEIGHT + 1 + HOUSE_RADIUS;

/** Where the house goes, and whether it stands for pending changes (its ring dashed, as the graph draws them). */
export interface HomeSpot {
  home: Point | null;
  pending: boolean;
}

/**
 * Where the house goes: on the curve at the workspace's column, or at its pending changes' column past every changeset
 * when it has some (where the graph moves its home badge too); pinned at the left edge when the workspace is older
 * than everything loaded. Where the curve stands taller than the room above it, the house sits into the curve rather
 * than over the top edge.
 */
export function homeSpots(mark: HomeMark, axis: TimelineAxis, curve: ActivityCurve): HomeSpot {
  if (mark === null) return { home: null, pending: false };
  if (mark.kind === 'olderThanRange') return { home: { x: PINNED_HOUSE_X, y: Math.max(HOUSE_TOP, BASELINE - HOUSE_LIFT) }, pending: false };
  const pending = mark.pendingColumn !== null;
  const x = stripXOfColumn(axis, pending ? mark.pendingColumn! : mark.column);
  return { home: { x, y: Math.max(HOUSE_TOP, curveTopAt(curve, x) - HOUSE_LIFT) }, pending };
}

/** The gaps whose break mark the house leaves room for: none drawn under it. */
export function gapsClearOfHome(gaps: readonly TimelineGap[], home: Point | null): readonly TimelineGap[] {
  return home ? gaps.filter((gap) => Math.abs(gap.x - home.x) > HOUSE_RADIUS + 4) : gaps;
}

/** How near (px) the pointer must be to grab or hover each thing. */
const REACH = { edge: 4, line: 5, label: 3, hit: 2, home: HOUSE_RADIUS, gap: 4 };

/**
 * What the pointer is on, the most precise first: the frame's edges (only where they have handles), a label tick under
 * the baseline, a search hit along the top, the house, a gap's break mark, the frame, else the
 * moment under it.
 */
export function timelineTargetAt(spots: TimelineSpots, x: number, y: number): TimelineTarget {
  const { frame } = spots;
  const shape = frameShape(frame);
  if (shape === 'boxWithEdges') {
    if (Math.abs(x - frame.left) <= REACH.edge) return { kind: 'frameEdge', edge: 'left' };
    if (Math.abs(x - frame.right) <= REACH.edge) return { kind: 'frameEdge', edge: 'right' };
  }
  if (y >= BASELINE && y <= MERGED_LABEL_TICK_TOP + MERGED_LABEL_TICK_HEIGHT + 3) {
    const tick = nearest(spots.labels, x, REACH.label);
    if (tick) return { kind: 'labels', tick };
  }
  if (y <= HIT_TICK_TOP + HIT_TICK_HEIGHT + 2) {
    const tick = nearest(spots.hits, x, REACH.hit);
    if (tick) return { kind: 'hits', tick };
  }
  if (spots.home && Math.hypot(x - spots.home.x, y - spots.home.y) <= REACH.home) return { kind: 'home' };
  if (y >= PLOT_TOP && y <= BASELINE) {
    const gap = nearest(spots.gaps, x, REACH.gap);
    if (gap) return { kind: 'gap', gap };
  }
  const middle = (frame.left + frame.right) / 2;
  const onFrame = shape === 'line' ? Math.abs(x - middle) <= REACH.line : x >= frame.left && x <= frame.right;
  return onFrame ? { kind: 'frame' } : { kind: 'moment' };
}

function nearest<T extends { x: number }>(items: readonly T[], x: number, reach: number): T | null {
  let best: T | null = null;
  for (const item of items) if (Math.abs(item.x - x) <= reach && (!best || Math.abs(item.x - x) < Math.abs(best.x - x))) best = item;
  return best;
}

/** What a press does: drag an edge to zoom, drag the frame to pan, or scrub (press and drag anywhere else). */
export type TimelinePress = { kind: 'zoom'; edge: 'left' | 'right' } | { kind: 'pan' } | { kind: 'scrub' };

export function timelinePress(target: TimelineTarget): TimelinePress {
  if (target.kind === 'frameEdge') return { kind: 'zoom', edge: target.edge };
  return target.kind === 'frame' ? { kind: 'pan' } : { kind: 'scrub' };
}

/** The pointer over the strip: resizing at the edges, grabbing the frame, pointing elsewhere. */
export function timelineCursor(target: TimelineTarget | null): 'ew-resize' | 'grab' | 'pointer' {
  if (target?.kind === 'frameEdge') return 'ew-resize';
  return target?.kind === 'frame' ? 'grab' : 'pointer';
}

/**
 * Where a click takes the view: a label tick to its newest label, a gap to where history resumes, the house to the
 * workspace (its pending changes when it has some), anything else to the column under the pointer.
 */
export function clickedColumn(target: TimelineTarget, x: number, axis: TimelineAxis, mark: HomeMark): number {
  switch (target.kind) {
    case 'labels':
      return target.tick.labels.at(-1)!.column;
    case 'gap':
      return target.gap.column;
    case 'home':
      return mark?.kind === 'inRange' ? (mark.pendingColumn ?? mark.column) : 0;
    default:
      return columnAtStrip(axis, x);
  }
}

/** The dashed frame showing where a click would take the view: only over an empty spot, where nothing else answers. */
export function ghostFrame(target: TimelineTarget | null, frame: TimelineFrame, x: number): TimelineFrame | null {
  return target?.kind === 'moment' ? frameCenteredAt(frame, x) : null;
}
